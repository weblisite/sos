import { Queue, Worker, Job } from 'bullmq';
import { AgentResponse } from './agentService';
import { langchainService } from './langchainService';
import { redis } from '../config/redis';
import { stackstormBullMQIntegration } from './stackstormBullMQIntegration';
import { stackstormConfig } from '../config/stackstorm';
import { featureFlagService } from './featureFlagService';

/**
 * Self-Healing Service
 * 
 * Detects agent failures and generates repair plans
 * Based on Archon framework principles
 */

export interface FailureType {
  type: 'timeout' | 'error' | 'invalid_output' | 'tool_failure' | 'llm_error' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface RepairPlan {
  planId: string;
  failureType: FailureType;
  steps: Array<{
    action: string;
    description: string;
    expectedOutcome: string;
    priority: number;
  }>;
  estimatedTime: number; // in milliseconds
  confidence: number; // 0-1
  generatedAt: Date;
}

export interface RepairResult {
  success: boolean;
  planId: string;
  executedSteps: string[];
  finalOutput?: string;
  error?: string;
  executionTime: number;
}

/**
 * Self-Healing Service
 */
export class SelfHealingService {
  private failureHistory: Map<string, FailureType[]> = new Map(); // agentId -> failures
  private repairPlans: Map<string, RepairPlan> = new Map(); // planId -> plan
  private repairQueue: Queue;
  private repairWorker: Worker | null = null;

  constructor() {
    // Initialize repair queue
    this.repairQueue = new Queue('agent-repair', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Initialize repair worker
    this.initializeWorker();
  }

  /**
   * Initialize repair worker
   */
  private initializeWorker(): void {
    this.repairWorker = new Worker(
      'agent-repair',
      async (job: Job) => {
        const { planId, originalQuery, agentConfig, context } = job.data;
        return await this.executeRepairPlan(planId, originalQuery, agentConfig, context);
      },
      {
        connection: redis,
        concurrency: 5, // Process up to 5 repairs concurrently
        limiter: {
          max: 10,
          duration: 1000, // Max 10 repairs per second
        },
      }
    );

    this.repairWorker.on('completed', (job) => {
      console.log(`✅ Repair job ${job.id} completed`);
    });

    this.repairWorker.on('failed', (job, err) => {
      console.error(`❌ Repair job ${job?.id} failed:`, err);
    });
  }

  /**
   * Queue repair plan for execution
   */
  async queueRepair(
    planId: string,
    originalQuery: string,
    agentConfig: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<string> {
    const job = await this.repairQueue.add(
      'execute-repair',
      {
        planId,
        originalQuery,
        agentConfig,
        context,
      },
      {
        priority: 1, // High priority for repairs
      }
    );

    return job.id!;
  }

  /**
   * Get repair job status
   */
  async getRepairStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    result?: RepairResult;
    error?: string;
  }> {
    const job = await this.repairQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Repair job ${jobId} not found`);
    }

    const state = await job.getState();
    
    return {
      status: state,
      progress: job.progress as number,
      result: job.returnvalue as RepairResult,
      error: job.failedReason,
    };
  }

  /**
   * Close repair queue and worker
   */
  async close(): Promise<void> {
    await this.repairQueue.close();
    if (this.repairWorker) {
      await this.repairWorker.close();
    }
  }

  /**
   * Detect failure from agent execution result or error
   */
  detectFailure(
    agentId: string,
    result: AgentResponse | null,
    error: Error | null
  ): FailureType | null {
    if (error) {
      // Error-based failure detection
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        return {
          type: 'timeout',
          severity: 'high',
          message: error.message,
          details: { originalError: error.message },
          timestamp: new Date(),
        };
      }

      if (errorMessage.includes('tool') || errorMessage.includes('execution')) {
        return {
          type: 'tool_failure',
          severity: 'medium',
          message: error.message,
          details: { originalError: error.message },
          timestamp: new Date(),
        };
      }

      if (errorMessage.includes('llm') || errorMessage.includes('api') || errorMessage.includes('openai') || errorMessage.includes('anthropic')) {
        return {
          type: 'llm_error',
          severity: 'high',
          message: error.message,
          details: { originalError: error.message },
          timestamp: new Date(),
        };
      }

      return {
        type: 'error',
        severity: 'high',
        message: error.message,
        details: { originalError: error.message },
        timestamp: new Date(),
      };
    }

    if (result) {
      // Result-based failure detection
      if (!result.output || result.output.trim().length === 0) {
        return {
          type: 'invalid_output',
          severity: 'medium',
          message: 'Agent returned empty output',
          details: { result },
          timestamp: new Date(),
        };
      }

      // Check for error indicators in output
      const outputLower = result.output.toLowerCase();
      if (outputLower.includes('error') || outputLower.includes('failed') || outputLower.includes('cannot')) {
        return {
          type: 'invalid_output',
          severity: 'low',
          message: 'Output contains error indicators',
          details: { result },
          timestamp: new Date(),
        };
      }

      // Check execution time (potential timeout)
      if (result.executionTime && result.executionTime > 60000) {
        return {
          type: 'timeout',
          severity: 'medium',
          message: 'Execution took too long',
          details: { executionTime: result.executionTime, result },
          timestamp: new Date(),
        };
      }
    }

    return null; // No failure detected
  }

  /**
   * Generate repair plan for a failure
   */
  async generateRepairPlan(
    agentId: string,
    failure: FailureType,
    originalQuery: string,
    context?: Record<string, unknown>
  ): Promise<RepairPlan> {
    const planId = `repair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build prompt for repair plan generation
    const repairPrompt = `You are a self-healing agent system. An agent execution has failed.

Failure Details:
- Type: ${failure.type}
- Severity: ${failure.severity}
- Message: ${failure.message}
${failure.details ? `- Details: ${JSON.stringify(failure.details, null, 2)}` : ''}

Original Query: ${originalQuery}

Generate a repair plan with specific steps to fix this failure. The plan should:
1. Identify the root cause
2. Propose specific actions to fix it
3. Estimate time for each step
4. Provide expected outcomes

Format your response as JSON:
{
  "rootCause": "description of root cause",
  "steps": [
    {
      "action": "specific action to take",
      "description": "detailed description",
      "expectedOutcome": "what should happen",
      "priority": 1
    }
  ],
  "estimatedTime": 5000,
  "confidence": 0.8
}`;

    try {
      const response = await langchainService.generateText(repairPrompt, {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.3, // Lower temperature for more deterministic repair plans
      });

      // Parse JSON response
      let repairData: any;
      try {
        // Extract JSON from response (might have markdown code blocks)
        const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/) || 
                         response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          repairData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
          repairData = JSON.parse(response.content);
        }
      } catch (parseError) {
        // Fallback to default repair plan
        repairData = this.generateDefaultRepairPlan(failure);
      }

      const plan: RepairPlan = {
        planId,
        failureType: failure,
        steps: repairData.steps || [],
        estimatedTime: repairData.estimatedTime || 5000,
        confidence: repairData.confidence || 0.7,
        generatedAt: new Date(),
      };

      this.repairPlans.set(planId, plan);
      return plan;
    } catch (error: any) {
      // Fallback to default repair plan
      return this.generateDefaultRepairPlan(failure, planId);
    }
  }

  /**
   * Generate default repair plan when LLM fails
   */
  private generateDefaultRepairPlan(failure: FailureType, planId?: string): RepairPlan {
    const defaultPlanId = planId || `repair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultSteps: RepairPlan['steps'] = [];

    switch (failure.type) {
      case 'timeout':
        defaultSteps.push(
          {
            action: 'reduce_max_iterations',
            description: 'Reduce maximum iterations to prevent timeout',
            expectedOutcome: 'Faster execution within time limit',
            priority: 1,
          },
          {
            action: 'simplify_query',
            description: 'Simplify the query or break it into smaller parts',
            expectedOutcome: 'Less complex execution',
            priority: 2,
          }
        );
        break;

      case 'tool_failure':
        defaultSteps.push(
          {
            action: 'retry_tool',
            description: 'Retry the failed tool execution',
            expectedOutcome: 'Tool execution succeeds',
            priority: 1,
          },
          {
            action: 'use_alternative_tool',
            description: 'Use an alternative tool if available',
            expectedOutcome: 'Task completed with alternative tool',
            priority: 2,
          }
        );
        break;

      case 'llm_error':
        defaultSteps.push(
          {
            action: 'retry_with_backoff',
            description: 'Retry the LLM call with exponential backoff',
            expectedOutcome: 'LLM call succeeds after retry',
            priority: 1,
          },
          {
            action: 'switch_provider',
            description: 'Switch to alternative LLM provider',
            expectedOutcome: 'Task completed with alternative provider',
            priority: 2,
          }
        );
        break;

      case 'invalid_output':
        defaultSteps.push(
          {
            action: 'regenerate_output',
            description: 'Regenerate the output with clearer instructions',
            expectedOutcome: 'Valid output generated',
            priority: 1,
          },
          {
            action: 'add_validation',
            description: 'Add output validation and retry',
            expectedOutcome: 'Output passes validation',
            priority: 2,
          }
        );
        break;

      default:
        defaultSteps.push(
          {
            action: 'retry_execution',
            description: 'Retry the entire execution',
            expectedOutcome: 'Execution succeeds on retry',
            priority: 1,
          },
          {
            action: 'simplify_approach',
            description: 'Simplify the approach and retry',
            expectedOutcome: 'Simpler execution succeeds',
            priority: 2,
          }
        );
    }

    return {
      planId: defaultPlanId,
      failureType: failure,
      steps: defaultSteps,
      estimatedTime: 5000,
      confidence: 0.6,
      generatedAt: new Date(),
    };
  }

  /**
   * Execute repair plan
   */
  async executeRepairPlan(
    planId: string,
    originalQuery: string,
    agentConfig: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<RepairResult> {
    const startTime = Date.now();
    const plan = this.repairPlans.get(planId);

    if (!plan) {
      throw new Error(`Repair plan ${planId} not found`);
    }

    const executedSteps: string[] = [];

    try {
      // Execute repair steps in priority order
      const sortedSteps = [...plan.steps].sort((a, b) => a.priority - b.priority);

      for (const step of sortedSteps) {
        executedSteps.push(step.action);

        // Execute repair action (simplified - in production, would have specific handlers)
        const result = await this.executeRepairAction(
          step,
          originalQuery,
          agentConfig,
          context
        );

        if (result.success) {
          // Repair successful
          return {
            success: true,
            planId,
            executedSteps,
            finalOutput: result.output,
            executionTime: Date.now() - startTime,
          };
        }
      }

      // All steps executed but none succeeded
      return {
        success: false,
        planId,
        executedSteps,
        error: 'All repair steps failed',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        planId,
        executedSteps,
        error: error.message || 'Repair execution failed',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a single repair action
   */
  private async executeRepairAction(
    step: RepairPlan['steps'][0],
    originalQuery: string,
    agentConfig: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<{ success: boolean; output?: string }> {
    // Simplified repair action execution
    // In production, this would have specific handlers for each action type

    switch (step.action) {
      case 'retry_execution':
      case 'retry_tool':
      case 'retry_with_backoff':
        // These would trigger a retry in the workflow executor
        return { success: false, output: 'Retry should be handled by executor' };

      case 'reduce_max_iterations':
        // Modify config
        if (agentConfig.maxIterations) {
          agentConfig.maxIterations = Math.max(1, (agentConfig.maxIterations as number) - 5);
        }
        return { success: true, output: 'Config modified' };

      case 'simplify_query':
        // Simplify query (basic implementation)
        const simplifiedQuery = originalQuery.length > 200 
          ? originalQuery.substring(0, 200) + '...'
          : originalQuery;
        return { success: true, output: simplifiedQuery };

      case 'regenerate_output':
        // Would trigger regeneration
        return { success: false, output: 'Regeneration should be handled by executor' };

      default:
        return { success: false, output: 'Unknown repair action' };
    }
  }

  /**
   * Get failure history for an agent
   */
  getFailureHistory(agentId: string): FailureType[] {
    return this.failureHistory.get(agentId) || [];
  }

  /**
   * Record failure
   */
  recordFailure(agentId: string, failure: FailureType): void {
    const history = this.failureHistory.get(agentId) || [];
    history.push(failure);
    
    // Keep only last 10 failures
    if (history.length > 10) {
      history.shift();
    }
    
    this.failureHistory.set(agentId, history);
  }

  /**
   * Get repair plan
   */
  getRepairPlan(planId: string): RepairPlan | null {
    return this.repairPlans.get(planId) || null;
  }

  /**
   * Clear failure history for an agent
   */
  clearFailureHistory(agentId: string): void {
    this.failureHistory.delete(agentId);
  }
}

export const selfHealingService = new SelfHealingService();

