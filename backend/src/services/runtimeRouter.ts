import { NodeExecutionResult } from '@sos/shared';
import { e2bRuntime } from './runtimes/e2bRuntime';
import { executeCode } from './nodeExecutors/code';
import { NodeExecutionContext } from '@sos/shared';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { db } from '../config/database';
import { codeExecLogs } from '../../drizzle/schema';
import { createId } from '@paralleldrive/cuid2';

/**
 * Runtime Router Service
 * 
 * Intelligently routes code execution to the best runtime based on:
 * - Execution time requirements (<50ms → E2B)
 * - Security requirements (sandbox → WasmEdge)
 * - Job length (long → Bacalhau)
 * - Default (VM2/subprocess)
 */

export interface CodeExecutionConfig {
  runtime?: 'vm2' | 'e2b' | 'wasmedge' | 'bacalhau' | 'subprocess' | 'auto';
  requiresSandbox?: boolean;
  longJob?: boolean;
  expectedDuration?: number; // milliseconds
  language: 'javascript' | 'python' | 'typescript' | 'bash';
  code: string;
  input: any;
  packages?: string[];
  timeout?: number;
}

export class RuntimeRouter {
  private runtimeMetrics: Map<string, {
    count: number;
    totalDuration: number;
    successCount: number;
    errorCount: number;
    lastUsed: Date;
  }> = new Map();

  /**
   * Route code execution to appropriate runtime
   */
  async route(
    config: CodeExecutionConfig,
    context?: {
      userId?: string;
      organizationId?: string;
      workspaceId?: string;
      workflowId?: string;
      nodeId?: string;
      executionId?: string;
    }
  ): Promise<NodeExecutionResult> {
    const tracer = trace.getTracer('sos-runtime-router');
    const span = tracer.startSpan('runtimeRouter.route', {
      attributes: {
        'runtime.language': config.language,
        'runtime.requested': config.runtime || 'auto',
        'runtime.requires_sandbox': config.requiresSandbox || false,
        'runtime.long_job': config.longJob || false,
        'runtime.expected_duration': config.expectedDuration || 0,
      },
    });

    const startTime = Date.now();
    let selectedRuntime: string = config.runtime || 'auto';
    let result: NodeExecutionResult;

    try {
      // If runtime is explicitly specified, use it
      if (config.runtime && config.runtime !== 'auto') {
        selectedRuntime = config.runtime;
        span.setAttributes({
          'runtime.selected': selectedRuntime,
          'runtime.reason': 'explicitly_specified',
        });
        result = await this.executeWithRuntime(selectedRuntime as any, config);
      } else {
        // Auto-route based on conditions
        selectedRuntime = this.selectRuntime(config);
        
        span.setAttributes({
          'runtime.selected': selectedRuntime,
          'runtime.reason': 'auto_routed',
        });
        result = await this.executeWithRuntime(selectedRuntime as any, config);
      }

      const duration = Date.now() - startTime;
      
      // Track runtime metrics
      this.trackRuntimeMetrics(selectedRuntime, duration, result.success, context);

      span.setAttributes({
        'runtime.duration_ms': duration,
        'runtime.success': result.success,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Track runtime metrics (error)
      this.trackRuntimeMetrics(selectedRuntime, duration, false, context);

      span.setAttributes({
        'runtime.duration_ms': duration,
        'runtime.success': false,
      });
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Track runtime metrics
   */
  private async trackRuntimeMetrics(
    runtime: string,
    duration: number,
    success: boolean,
    context?: {
      userId?: string;
      organizationId?: string;
      workspaceId?: string;
      workflowId?: string;
      nodeId?: string;
      executionId?: string;
    }
  ): Promise<void> {
    try {
      // Update in-memory metrics
      const metrics = this.runtimeMetrics.get(runtime) || {
        count: 0,
        totalDuration: 0,
        successCount: 0,
        errorCount: 0,
        lastUsed: new Date(),
      };

      metrics.count++;
      metrics.totalDuration += duration;
      if (success) {
        metrics.successCount++;
      } else {
        metrics.errorCount++;
      }
      metrics.lastUsed = new Date();

      this.runtimeMetrics.set(runtime, metrics);

      // Log to database if context is provided
      if (context && (context.userId || context.workspaceId)) {
        try {
          await db.insert(codeExecLogs).values({
            id: createId(),
            runtime,
            language: 'unknown', // Could be passed from config
            duration,
            success,
            userId: context.userId || null,
            organizationId: context.organizationId || null,
            workspaceId: context.workspaceId || null,
            workflowId: context.workflowId || null,
            nodeId: context.nodeId || null,
            executionId: context.executionId || null,
            createdAt: new Date(),
          });
        } catch (dbError: any) {
          // Log but don't throw - metrics tracking should not break execution
          console.warn('[RuntimeRouter] Failed to log runtime metrics to database:', dbError.message);
        }
      }
    } catch (error: any) {
      // Silently fail - metrics tracking should not break execution
      console.warn('[RuntimeRouter] Failed to track runtime metrics:', error.message);
    }
  }

  /**
   * Get runtime metrics
   */
  getRuntimeMetrics(): Record<string, {
    count: number;
    avgDuration: number;
    successRate: number;
    lastUsed: Date;
  }> {
    const metrics: Record<string, any> = {};
    
    for (const [runtime, data] of this.runtimeMetrics.entries()) {
      metrics[runtime] = {
        count: data.count,
        avgDuration: data.count > 0 ? data.totalDuration / data.count : 0,
        successRate: data.count > 0 ? data.successCount / data.count : 0,
        lastUsed: data.lastUsed,
      };
    }
    
    return metrics;
  }

  /**
   * Select best runtime based on config
   */
  private selectRuntime(config: CodeExecutionConfig): 'vm2' | 'e2b' | 'wasmedge' | 'bacalhau' | 'subprocess' {
    // Long-running jobs → Bacalhau
    if (config.longJob) {
      return 'bacalhau';
    }

    // Requires sandbox → WasmEdge (or E2B if available and fast enough)
    if (config.requiresSandbox) {
      // If expected duration is <50ms and E2B is available, use E2B
      if (config.expectedDuration && config.expectedDuration < 50 && e2bRuntime.isAvailable()) {
        return 'e2b';
      }
      // Otherwise use WasmEdge (when implemented)
      // For now, fall back to VM2 for JS or subprocess for Python/Bash
      return config.language === 'javascript' || config.language === 'typescript' ? 'vm2' : 'subprocess';
    }

    // Expected duration <50ms → E2B
    if (config.expectedDuration && config.expectedDuration < 50 && e2bRuntime.isAvailable()) {
      return 'e2b';
    }

    // Default routing based on language
    if (config.language === 'javascript' || config.language === 'typescript') {
      return 'vm2';
    } else if (config.language === 'python' || config.language === 'bash') {
      return 'subprocess';
    }

    // Fallback
    return 'vm2';
  }

  /**
   * Execute code with specific runtime
   */
  private async executeWithRuntime(
    runtime: 'vm2' | 'e2b' | 'wasmedge' | 'bacalhau' | 'subprocess',
    config: CodeExecutionConfig
  ): Promise<NodeExecutionResult> {
    switch (runtime) {
      case 'e2b':
        if (!e2bRuntime.isAvailable()) {
          // Fallback to default if E2B not available
          return await this.executeWithRuntime(
            config.language === 'javascript' || config.language === 'typescript' ? 'vm2' : 'subprocess',
            config
          );
        }
        return await e2bRuntime.execute(
          config.code,
          config.language,
          config.input,
          config.timeout || 5000
        );

      case 'wasmedge':
        // TODO: Implement WasmEdge runtime
        // For now, fallback to default
        return await this.executeWithRuntime(
          config.language === 'javascript' || config.language === 'typescript' ? 'vm2' : 'subprocess',
          config
        );

      case 'bacalhau':
        // TODO: Implement Bacalhau runtime
        // For now, fallback to default
        return await this.executeWithRuntime(
          config.language === 'javascript' || config.language === 'typescript' ? 'vm2' : 'subprocess',
          config
        );

      case 'vm2':
      case 'subprocess':
      default:
        // Use existing code executor (VM2 for JS/TS, subprocess for Python/Bash)
        const context: NodeExecutionContext = {
          input: config.input,
          config: {
            code: config.code,
            packages: config.packages || [],
            timeout: config.timeout || 30000,
            runtime,
          },
          workflowId: 'runtime-router',
          nodeId: 'code-execution',
        };
        return await executeCode(context, config.language);
    }
  }
}

export const runtimeRouter = new RuntimeRouter();

