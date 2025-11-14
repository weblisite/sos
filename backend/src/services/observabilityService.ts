/**
 * Observability Service
 * 
 * Provides tracing and metrics for agent executions
 * Supports:
 * - Distributed tracing (when OpenTelemetry is available)
 * - Performance metrics
 * - Error tracking
 * - Custom spans for agent operations
 * - Database-backed event logging
 */

import { db } from '../config/database';
import { eventLogs, workspaces } from '../../drizzle/schema';
import { createId } from '@paralleldrive/cuid2';
import { lt, eq, and, gte, inArray } from 'drizzle-orm';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { rudderstackService } from './rudderstackService';
import { langfuseService } from './langfuseService';

interface AgentSpanContext {
  agentId: string;
  framework: string;
  query: string;
  executionId: string;
  organizationId?: string;
  userId?: string;
  workspaceId?: string;
}

interface AgentExecutionMetrics {
  framework: string;
  duration: number; // ms
  success: boolean;
  tokensUsed?: number;
  cost?: number;
  error?: string;
}

/**
 * Observability Service
 * 
 * Database-backed observability service
 * Writes all events to event_logs table
 */
export class ObservabilityService {
  private activeSpans: Map<string, any> = new Map();

  constructor() {
    console.log('✅ Observability service initialized (database-backed)');
  }

  /**
   * Start a new span for agent execution
   */
  startAgentSpan(context: AgentSpanContext): any {
    const spanId = `${context.executionId}-${Date.now()}`;
    const span = {
      id: spanId,
      context,
      startTime: Date.now(),
    };
    this.activeSpans.set(spanId, span);
    console.log(`[Observability] Started span for agent ${context.agentId} (${context.framework})`);
    return span;
  }

  /**
   * Set span status
   */
  setStatus(span: any, status: 'ok' | 'error', message?: string): void {
    if (span) {
      span.status = status;
      span.statusMessage = message;
      if (status === 'error' && message) {
        console.error(`[Observability] Span error: ${message}`);
      }
    }
  }

  /**
   * End a span
   */
  endSpan(span: any): void {
    if (span) {
      const duration = Date.now() - span.startTime;
      console.log(`[Observability] Ended span ${span.id} (duration: ${duration}ms)`);
      this.activeSpans.delete(span.id);
    }
  }

  /**
   * Record agent execution metrics
   * Writes to event_logs table and exports to Langfuse
   */
  async recordExecution(
    framework: string,
    duration: number,
    success: boolean,
    userId?: string,
    workspaceId?: string,
    traceId?: string,
    tokensUsed?: number,
    cost?: number,
    error?: string,
    agentId?: string,
    query?: string,
    executionId?: string,
    organizationId?: string,
    startTime?: Date,
    endTime?: Date,
    intermediateSteps?: any[],
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Get trace ID from OpenTelemetry context if not provided
      let finalTraceId = traceId;
      if (!finalTraceId) {
        try {
          const activeSpan = trace.getActiveSpan();
          if (activeSpan) {
            const spanContext = activeSpan.spanContext();
            finalTraceId = spanContext.traceId;
          }
        } catch (err) {
          // Ignore errors getting trace ID
        }
      }

      // Generate trace ID if still not available
      if (!finalTraceId) {
        finalTraceId = createId();
      }

      const now = new Date();
      const executionStartTime = startTime || new Date(now.getTime() - duration);
      const executionEndTime = endTime || now;

      // Extract intermediateSteps from context parameter or context object
      const contextData = context || {};
      const extractedIntermediateSteps = intermediateSteps || 
        (contextData as any)?.executionNodes || 
        (contextData as any)?.intermediateSteps || 
        [];

      // Write to database
      await db.insert(eventLogs).values({
        id: createId(),
        userId: userId || null,
        workspaceId: workspaceId || null,
        eventType: 'agent_execution',
        context: {
          framework,
          tokensUsed,
          cost,
          error,
          agentId,
          query,
          executionId,
          intermediateSteps: intermediateSteps.length > 0 ? intermediateSteps : undefined,
        },
        status: success ? 'success' : 'error',
        latencyMs: duration,
        traceId: finalTraceId || null,
        timestamp: executionEndTime,
      });

      // Export to Langfuse (async, non-blocking)
      if (langfuseService.isEnabled() && agentId && query && executionId) {
        langfuseService.exportAgentExecution({
          traceId: finalTraceId,
          agentId,
          framework,
          query,
          executionId,
          userId,
          organizationId,
          workspaceId,
          startTime: executionStartTime,
          endTime: executionEndTime,
          success,
          error,
          cost,
          tokens: tokensUsed
            ? {
                total: tokensUsed,
                // Split tokens if we have more info (could be enhanced)
                prompt: Math.floor(tokensUsed * 0.7), // Estimate
                completion: Math.floor(tokensUsed * 0.3), // Estimate
              }
            : undefined,
          metadata: {
            duration,
            latencyMs: duration,
          },
          intermediateSteps: extractedIntermediateSteps.length > 0 ? extractedIntermediateSteps : undefined,
        }).catch((err: any) => {
          // Log but don't throw - Langfuse export should not break execution
          console.warn('[Observability] Langfuse export failed:', err);
        });
      }

      // Forward to RudderStack
      if (userId && workspaceId) {
        rudderstackService.forwardDatabaseEvent({
          eventType: 'agent_execution',
          userId,
          workspaceId,
          properties: {
            framework,
            tokensUsed,
            cost,
            error,
            success,
            duration,
          },
          traceId: finalTraceId || undefined,
        });
      }

      console.log(`[Observability] Agent execution recorded: Framework=${framework}, Duration=${duration}ms, Success=${success}`);
    } catch (err: any) {
      console.error('[Observability] Failed to record execution:', err);
      // Don't throw - observability should not break execution
    }
  }

  /**
   * Log a general event
   */
  async logEvent(
    eventType: string,
    status: 'success' | 'error' | 'pending',
    userId?: string,
    workspaceId?: string,
    context?: Record<string, unknown>,
    latencyMs?: number,
    traceId?: string
  ): Promise<void> {
    try {
      // Get trace ID from OpenTelemetry context if not provided
      let finalTraceId = traceId;
      if (!finalTraceId) {
        try {
          const activeSpan = trace.getActiveSpan();
          if (activeSpan) {
            const spanContext = activeSpan.spanContext();
            finalTraceId = spanContext.traceId;
          }
        } catch (err) {
          // Ignore errors getting trace ID
        }
      }

      await db.insert(eventLogs).values({
        id: createId(),
        userId: userId || null,
        workspaceId: workspaceId || null,
        eventType,
        context: context || null,
        status,
        latencyMs: latencyMs || null,
        traceId: finalTraceId || null,
        timestamp: new Date(),
      });
    } catch (err: any) {
      console.error('[Observability] Failed to log event:', err);
      // Don't throw - observability should not break execution
    }
  }

  /**
   * Get system metrics from database
   */
  async getSystemMetrics(range: string = '24h', userId?: string, workspaceId?: string): Promise<any> {
    try {
      const cutoffDate = this.getCutoffDate(range);
      
      // Query event_logs for agent_execution events
      const conditions = [
        eq(eventLogs.eventType, 'agent_execution'),
        gte(eventLogs.timestamp, cutoffDate),
      ];
      if (userId) {
        conditions.push(eq(eventLogs.userId, userId));
      }
      if (workspaceId) {
        conditions.push(eq(eventLogs.workspaceId, workspaceId));
      }

      const events = await db
        .select()
        .from(eventLogs)
        .where(and(...conditions));

      const totalExecutions = events.length;
      const successfulExecutions = events.filter(e => e.status === 'success').length;
      const failedExecutions = totalExecutions - successfulExecutions;
      const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
      
      const avgExecutionTime = totalExecutions > 0
        ? events.reduce((sum, e) => sum + (e.latencyMs || 0), 0) / totalExecutions
        : 0;

      // Extract tokens and cost from context
      const totalTokens = events.reduce((sum, e) => {
        const context = e.context as any;
        return sum + (context?.tokensUsed || 0);
      }, 0);
      
      const totalCost = events.reduce((sum, e) => {
        const context = e.context as any;
        return sum + (context?.cost || 0);
      }, 0);

      // Group by framework
      const frameworkMap = new Map<string, typeof events>();
      events.forEach(e => {
        const context = e.context as any;
        const framework = context?.framework || 'unknown';
        const existing = frameworkMap.get(framework) || [];
        existing.push(e);
        frameworkMap.set(framework, existing);
      });

      const frameworks = Array.from(frameworkMap.entries()).map(([framework, frameworkEvents]) => {
        const frameworkTotal = frameworkEvents.length;
        const frameworkSuccess = frameworkEvents.filter(e => e.status === 'success').length;
        const frameworkSuccessRate = frameworkTotal > 0 ? (frameworkSuccess / frameworkTotal) * 100 : 0;
        const frameworkAvgTime = frameworkTotal > 0
          ? frameworkEvents.reduce((sum, e) => sum + (e.latencyMs || 0), 0) / frameworkTotal
          : 0;
        const frameworkTokens = frameworkEvents.reduce((sum, e) => {
          const context = e.context as any;
          return sum + (context?.tokensUsed || 0);
        }, 0);
        const frameworkCost = frameworkEvents.reduce((sum, e) => {
          const context = e.context as any;
          return sum + (context?.cost || 0);
        }, 0);

        return {
          framework,
          totalExecutions: frameworkTotal,
          successfulExecutions: frameworkSuccess,
          failedExecutions: frameworkTotal - frameworkSuccess,
          successRate: frameworkSuccessRate,
          averageExecutionTime: frameworkAvgTime,
          totalTokens: frameworkTokens,
          totalCost: frameworkCost,
        };
      });

      return {
        totalExecutions,
        totalErrors: failedExecutions,
        averageExecutionTime: avgExecutionTime,
        totalTokens,
        totalCost,
        successRate,
        frameworks,
      };
    } catch (err: any) {
      console.error('[Observability] Failed to get system metrics:', err);
      return {
        totalExecutions: 0,
        totalErrors: 0,
        averageExecutionTime: 0,
        totalTokens: 0,
        totalCost: 0,
        successRate: 0,
        frameworks: [],
      };
    }
  }

  /**
   * Get error logs from database
   */
  async getErrorLogs(range: string = '24h', userId?: string, workspaceId?: string): Promise<any> {
    try {
      const cutoffDate = this.getCutoffDate(range);
      
      const errorConditions = [
        eq(eventLogs.status, 'error'),
        gte(eventLogs.timestamp, cutoffDate),
      ];
      if (userId) {
        errorConditions.push(eq(eventLogs.userId, userId));
      }
      if (workspaceId) {
        errorConditions.push(eq(eventLogs.workspaceId, workspaceId));
      }

      const errors = await db
        .select()
        .from(eventLogs)
        .where(and(...errorConditions))
        .limit(100);

      return {
        errors: errors.map(e => ({
          timestamp: e.timestamp.toISOString(),
          level: 'error',
          message: (e.context as any)?.error || 'Unknown error',
          framework: (e.context as any)?.framework || 'unknown',
          errorType: 'execution_error',
          eventType: e.eventType,
          traceId: e.traceId,
        })),
      };
    } catch (err: any) {
      console.error('[Observability] Failed to get error logs:', err);
      return { errors: [] };
    }
  }

  /**
   * Get cutoff date based on time range
   */
  private getCutoffDate(range: string): Date {
    const now = new Date();
    let cutoffDate = new Date();

    switch (range) {
      case '1h':
        cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
    }

    return cutoffDate;
  }

  /**
   * Clean up old events based on retention policy
   * Retention: 90 days Free, 1 year Pro, configurable Enterprise
   * 
   * Note: This cleans up all events globally. For organization-specific cleanup,
   * use cleanupOldEventsForOrganization instead.
   */
  async cleanupOldEvents(plan: 'free' | 'pro' | 'team' | 'enterprise' = 'free', customRetentionDays?: number): Promise<void> {
    try {
      let retentionDays = 90; // Default for free plan

      switch (plan) {
        case 'free':
          retentionDays = 90;
          break;
        case 'pro':
        case 'team':
          retentionDays = 365; // 1 year
          break;
        case 'enterprise':
          retentionDays = customRetentionDays || 365; // Configurable, default 1 year
          break;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean up events older than retention period
      // Note: This is a global cleanup. For production, you might want to
      // clean up per organization/workspace based on their plan
      await db
        .delete(eventLogs)
        .where(lt(eventLogs.timestamp, cutoffDate));

      console.log(`[Observability] Cleaned up events older than ${retentionDays} days (plan: ${plan})`);
    } catch (err: any) {
      console.error('[Observability] Failed to cleanup old events:', err);
    }
  }

  /**
   * Clean up old events for a specific organization based on their plan
   */
  async cleanupOldEventsForOrganization(organizationId: string, plan: 'free' | 'pro' | 'team' | 'enterprise', customRetentionDays?: number): Promise<void> {
    try {
      let retentionDays = 90;

      switch (plan) {
        case 'free':
          retentionDays = 90;
          break;
        case 'pro':
        case 'team':
          retentionDays = 365;
          break;
        case 'enterprise':
          retentionDays = customRetentionDays || 365;
          break;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Get all workspaces for this organization
      const orgWorkspaces = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.organizationId, organizationId));

      const workspaceIds = orgWorkspaces.map(w => w.id);

      if (workspaceIds.length === 0) {
        return; // No workspaces to clean up
      }

      // Clean up events for all workspaces in this organization
      await db
        .delete(eventLogs)
        .where(
          and(
            lt(eventLogs.timestamp, cutoffDate),
            inArray(eventLogs.workspaceId, workspaceIds)
          )
        );

      console.log(`[Observability] Cleaned up events for org ${organizationId} (plan: ${plan}, retention: ${retentionDays} days)`);
    } catch (err: any) {
      console.error(`[Observability] Failed to cleanup events for org ${organizationId}:`, err);
    }
  }
}

export const observabilityService = new ObservabilityService();
