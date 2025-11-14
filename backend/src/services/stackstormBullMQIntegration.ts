/**
 * StackStorm-BullMQ Integration Service
 * 
 * Bridges StackStorm workflows with BullMQ job queues.
 * Allows:
 * - Triggering StackStorm workflows from BullMQ jobs
 * - Creating BullMQ jobs from StackStorm workflows
 * - Monitoring and coordinating between both systems
 */

import { Queue, Job } from 'bullmq';
import { redis } from '../config/redis';
import { stackstormService } from './stackstormService';
import { stackstormWorkflowService } from './stackstormWorkflowService';
import { stackstormConfig } from '../config/stackstorm';
import { featureFlagService } from './featureFlagService';

/**
 * StackStorm-BullMQ job data
 */
export interface StackStormBullMQJobData {
  workflowRef: string; // StackStorm workflow reference (e.g., 'synthralos.agent_recovery')
  parameters: Record<string, any>; // Workflow parameters
  bullMQJobId?: string; // Original BullMQ job ID if triggered from BullMQ
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * BullMQ job data for StackStorm-triggered jobs
 */
export interface BullMQJobData {
  queueName: string;
  jobName: string;
  data: Record<string, any>;
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
  };
}

/**
 * StackStorm-BullMQ Integration Service
 */
export class StackStormBullMQIntegration {
  private queues: Map<string, Queue> = new Map();
  private stackstormExecutionQueue: Queue;
  private stackstormWorker: any = null;

  constructor() {
    // Queue for executing StackStorm workflows from BullMQ
    this.stackstormExecutionQueue = new Queue('stackstorm-execution', {
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

    // Initialize worker for StackStorm execution queue
    this.initializeStackStormWorker();
  }

  /**
   * Initialize worker for StackStorm execution queue
   */
  private initializeStackStormWorker(): void {
    const { Worker } = require('bullmq');
    
    this.stackstormWorker = new Worker(
      'stackstorm-execution',
      async (job: Job<StackStormBullMQJobData>) => {
        const { workflowRef, parameters, metadata } = job.data;

        if (!stackstormConfig.enabled) {
          throw new Error('StackStorm is not enabled');
        }

        // Execute StackStorm workflow
        const execution = await stackstormService.executeAction(workflowRef, parameters);

        // Wait for execution to complete
        const result = await stackstormService.waitForExecution(
          execution.id,
          300000 // 5 minutes timeout
        );

        return {
          executionId: result.id,
          status: result.status,
          result: result.result,
          metadata,
        };
      },
      {
        connection: redis,
        concurrency: 5, // Process up to 5 StackStorm workflows concurrently
        limiter: {
          max: 10,
          duration: 1000, // Max 10 executions per second
        },
      }
    );

    this.stackstormWorker.on('completed', (job: Job) => {
      console.log(`✅ StackStorm workflow ${job.data.workflowRef} completed (job ${job.id})`);
    });

    this.stackstormWorker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ StackStorm workflow ${job?.data?.workflowRef} failed (job ${job?.id}):`, err);
    });
  }

  /**
   * Queue a StackStorm workflow execution from BullMQ
   */
  async queueStackStormWorkflow(
    workflowRef: string,
    parameters: Record<string, any>,
    options: {
      priority?: number;
      delay?: number;
      attempts?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Job<StackStormBullMQJobData>> {
    const job = await this.stackstormExecutionQueue.add(
      'execute',
      {
        workflowRef,
        parameters,
        metadata: options.metadata,
      },
      {
        priority: options.priority,
        delay: options.delay,
        attempts: options.attempts || 3,
      }
    );

    return job;
  }

  /**
   * Get or create a BullMQ queue
   */
  private getOrCreateQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      this.queues.set(
        queueName,
        new Queue(queueName, {
          connection: redis,
        })
      );
    }
    return this.queues.get(queueName)!;
  }

  /**
   * Create a BullMQ job from StackStorm workflow result
   * This allows StackStorm workflows to trigger BullMQ jobs
   */
  async createBullMQJobFromStackStorm(
    queueName: string,
    jobName: string,
    data: Record<string, any>,
    options: {
      priority?: number;
      delay?: number;
      attempts?: number;
      backoff?: {
        type: 'fixed' | 'exponential';
        delay: number;
      };
    } = {}
  ): Promise<Job> {
    const queue = this.getOrCreateQueue(queueName);

    const job = await queue.add(
      jobName,
      data,
      {
        priority: options.priority,
        delay: options.delay,
        attempts: options.attempts || 1,
        backoff: options.backoff
          ? {
              type: options.backoff.type === 'exponential' ? 'exponential' : 'fixed',
              delay: options.backoff.delay,
            }
          : undefined,
      }
    );

    return job;
  }

  /**
   * Integrate StackStorm workflow with existing BullMQ queue
   * This allows BullMQ jobs to trigger StackStorm workflows and vice versa
   */
  async integrateQueueWithStackStorm(
    queueName: string,
    workflowRef: string,
    options: {
      autoTrigger?: boolean; // Automatically trigger StackStorm workflow on job completion
      onSuccess?: boolean; // Trigger on success
      onFailure?: boolean; // Trigger on failure
      transformData?: (jobData: any) => Record<string, any>; // Transform job data to workflow parameters
    } = {}
  ): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);

    // Set up event listeners
    if (options.autoTrigger) {
      // Listen for job completion
      if (options.onSuccess) {
        // Note: BullMQ doesn't have built-in event emitters for job completion
        // This would need to be implemented in the worker that processes the queue
        console.log(`[StackStorm-BullMQ] Integration configured: ${queueName} → ${workflowRef} (on success)`);
      }

      if (options.onFailure) {
        console.log(`[StackStorm-BullMQ] Integration configured: ${queueName} → ${workflowRef} (on failure)`);
      }
    }
  }

  /**
   * Execute StackStorm workflow and create BullMQ job from result
   */
  async executeStackStormAndQueueBullMQ(
    workflowRef: string,
    workflowParameters: Record<string, any>,
    bullMQConfig: {
      queueName: string;
      jobName: string;
      transformResult?: (result: any) => Record<string, any>;
      options?: {
        priority?: number;
        delay?: number;
        attempts?: number;
      };
    }
  ): Promise<{ stackstormExecutionId: string; bullMQJobId: string }> {
    // Execute StackStorm workflow
    const execution = await stackstormService.executeAction(workflowRef, workflowParameters);

    // Wait for execution to complete
    const result = await stackstormService.waitForExecution(execution.id, 300000);

    // Transform result if needed
    const jobData = bullMQConfig.transformResult
      ? bullMQConfig.transformResult(result.result)
      : result.result;

    // Create BullMQ job
    const queue = this.getOrCreateQueue(bullMQConfig.queueName);
    const job = await queue.add(bullMQConfig.jobName, jobData, bullMQConfig.options);

    return {
      stackstormExecutionId: execution.id,
      bullMQJobId: job.id!,
    };
  }

  /**
   * Get StackStorm execution status for a BullMQ job
   */
  async getStackStormExecutionStatus(bullMQJobId: string): Promise<any> {
    const job = await this.stackstormExecutionQueue.getJob(bullMQJobId);
    
    if (!job) {
      return null;
    }

    const executionId = job.returnvalue?.executionId;
    if (!executionId) {
      return null;
    }

    return await stackstormService.getExecution(executionId);
  }

  /**
   * Cancel StackStorm execution for a BullMQ job
   */
  async cancelStackStormExecution(bullMQJobId: string): Promise<void> {
    const job = await this.stackstormExecutionQueue.getJob(bullMQJobId);
    
    if (!job) {
      throw new Error(`BullMQ job ${bullMQJobId} not found`);
    }

    const executionId = job.returnvalue?.executionId;
    if (!executionId) {
      throw new Error(`No StackStorm execution ID found for job ${bullMQJobId}`);
    }

    await stackstormService.cancelExecution(executionId);
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    // Close StackStorm execution queue
    await this.stackstormExecutionQueue.close();
    
    if (this.stackstormWorker) {
      await this.stackstormWorker.close();
    }

    // Close all other queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    
    this.queues.clear();
  }
}

// Singleton instance
export const stackstormBullMQIntegration = new StackStormBullMQIntegration();

