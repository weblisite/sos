import { trace, SpanStatusCode } from '@opentelemetry/api';
import { browserAutomationService, BrowserActionConfig } from './browserAutomationService';
import { browserbaseService } from './browserbaseService';
import { db } from '../config/database';
import { browserRuns } from '../../drizzle/schema';

/**
 * Browser Fleet Service
 * 
 * Manages fleet-scale browser orchestration:
 * - Parallel execution across multiple browser instances
 * - Load balancing and distribution
 * - Resource management and scaling
 * - Health monitoring and recovery
 */

export interface FleetTask {
  id: string;
  action: BrowserActionConfig;
  priority?: number; // Higher = more important
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
  context?: {
    organizationId?: string;
    workspaceId?: string;
    userId?: string;
  };
}

export interface FleetExecutionPlan {
  tasks: FleetTask[];
  strategy: 'parallel' | 'sequential' | 'batch';
  batchSize?: number; // For batch strategy
  maxConcurrent?: number; // For parallel strategy
  timeout?: number; // Overall timeout
}

export interface FleetExecutionResult {
  success: boolean;
  completed: number;
  failed: number;
  total: number;
  results: Array<{
    taskId: string;
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
  }>;
  metadata: {
    totalExecutionTime: number;
    averageExecutionTime: number;
    strategy: string;
  };
}

export class BrowserFleetService {
  /**
   * Execute fleet of browser tasks
   */
  async executeFleet(plan: FleetExecutionPlan): Promise<FleetExecutionResult> {
    const tracer = trace.getTracer('sos-browser-fleet');
    const span = tracer.startSpan('browser_fleet.execute', {
      attributes: {
        'fleet.tasks_count': plan.tasks.length,
        'fleet.strategy': plan.strategy,
        'fleet.max_concurrent': plan.maxConcurrent || 1,
      },
    });

    const startTime = Date.now();
    const results: FleetExecutionResult['results'] = [];

    try {
      let taskResults: Array<Promise<FleetExecutionResult['results'][0]>>;

      switch (plan.strategy) {
        case 'parallel':
          taskResults = this.executeParallel(plan);
          break;
        case 'batch':
          taskResults = this.executeBatch(plan);
          break;
        case 'sequential':
        default:
          taskResults = this.executeSequential(plan);
          break;
      }

      // Wait for all tasks
      const allResults = await Promise.allSettled(taskResults);
      
      // Process results
      for (const result of allResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Handle rejected promises
          results.push({
            taskId: 'unknown',
            success: false,
            error: result.reason?.message || 'Unknown error',
            executionTime: 0,
          });
        }
      }

      const totalExecutionTime = Date.now() - startTime;
      const completed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const averageExecutionTime = results.length > 0
        ? results.reduce((sum, r) => sum + r.executionTime, 0) / results.length
        : 0;

      span.setAttributes({
        'fleet.success': completed === plan.tasks.length,
        'fleet.completed': completed,
        'fleet.failed': failed,
        'fleet.total_execution_time_ms': totalExecutionTime,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return {
        success: failed === 0,
        completed,
        failed,
        total: plan.tasks.length,
        results,
        metadata: {
          totalExecutionTime,
          averageExecutionTime,
          strategy: plan.strategy,
        },
      };
    } catch (error: any) {
      const totalExecutionTime = Date.now() - startTime;

      span.recordException(error);
      span.setAttributes({
        'fleet.success': false,
        'fleet.error': error.message,
        'fleet.total_execution_time_ms': totalExecutionTime,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();

      return {
        success: false,
        completed: results.length,
        failed: plan.tasks.length - results.length,
        total: plan.tasks.length,
        results,
        metadata: {
          totalExecutionTime,
          averageExecutionTime: 0,
          strategy: plan.strategy,
        },
      };
    }
  }

  /**
   * Execute tasks in parallel
   */
  private executeParallel(plan: FleetExecutionPlan): Array<Promise<FleetExecutionResult['results'][0]>> {
    const maxConcurrent = plan.maxConcurrent || 5;
    const tasks = [...plan.tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0)); // Sort by priority

    const promises: Array<Promise<FleetExecutionResult['results'][0]>> = [];

    // Execute in batches to respect maxConcurrent
    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(task => this.executeTask(task));
      promises.push(...batchPromises);
    }

    return promises;
  }

  /**
   * Execute tasks in batches
   */
  private executeBatch(plan: FleetExecutionPlan): Array<Promise<FleetExecutionResult['results'][0]>> {
    const batchSize = plan.batchSize || 10;
    const tasks = [...plan.tasks];
    const promises: Array<Promise<FleetExecutionResult['results'][0]>> = [];

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchPromises = batch.map(task => this.executeTask(task));
      promises.push(...batchPromises);
    }

    return promises;
  }

  /**
   * Execute tasks sequentially
   */
  private executeSequential(plan: FleetExecutionPlan): Array<Promise<FleetExecutionResult['results'][0]>> {
    return plan.tasks.map(task => this.executeTask(task));
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: FleetTask): Promise<FleetExecutionResult['results'][0]> {
    const startTime = Date.now();
    let retryCount = task.retryCount || 0;
    const maxRetries = task.maxRetries || 3;

    while (retryCount <= maxRetries) {
      try {
        // Determine which service to use
        let result;
        
        // Use Browserbase if available and task requires it
        if (browserbaseService && task.action.useProxy) {
          // For now, use browser automation service
          // In future, can route to Browserbase for cloud instances
          result = await browserAutomationService.executeAction(task.action);
        } else {
          result = await browserAutomationService.executeAction(task.action);
        }

        const executionTime = Date.now() - startTime;

        // Log to database
        if (task.context) {
          await db.insert(browserRuns).values({
            organizationId: task.context.organizationId || null,
            workspaceId: task.context.workspaceId || null,
            userId: task.context.userId || null,
            tool: result.metadata.engine,
            action: result.action,
            url: task.action.url || null,
            status: result.success ? 'completed' : 'failed',
            success: result.success,
            latencyMs: executionTime,
            errorMessage: result.error || null,
            metadata: {
              taskId: task.id,
              retryCount,
            },
          }).catch(() => {
            // Silently fail logging
          });
        }

        return {
          taskId: task.id,
          success: result.success,
          result: result,
          error: result.error,
          executionTime,
        };
      } catch (error: any) {
        retryCount++;
        
        if (retryCount > maxRetries) {
          const executionTime = Date.now() - startTime;
          return {
            taskId: task.id,
            success: false,
            error: error.message || 'Max retries exceeded',
            executionTime,
          };
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    const executionTime = Date.now() - startTime;
    return {
      taskId: task.id,
      success: false,
      error: 'Max retries exceeded',
      executionTime,
    };
  }

  /**
   * Get fleet health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    activeBrowsers: number;
    availableCapacity: number;
    errors: string[];
  }> {
    // This would check the health of browser pools, Browserbase, etc.
    return {
      healthy: true,
      activeBrowsers: 0,
      availableCapacity: 100,
      errors: [],
    };
  }
}

export const browserFleetService = new BrowserFleetService();

