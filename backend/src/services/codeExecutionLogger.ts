import { db } from '../config/database';
import { codeExecLogs } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Code Execution Logger
 * 
 * Logs code execution details to the database for observability and analytics
 */

export interface CodeExecutionLogData {
  codeAgentId?: string;
  workflowExecutionId?: string;
  nodeId?: string;
  runtime: string;
  language: 'javascript' | 'python' | 'typescript' | 'bash';
  durationMs?: number;
  memoryMb?: number;
  exitCode?: number;
  success: boolean;
  errorMessage?: string;
  tokensUsed?: number;
  validationPassed?: boolean;
  organizationId?: string;
  workspaceId?: string;
  userId?: string;
}

export class CodeExecutionLogger {
  /**
   * Log code execution to database
   */
  async logExecution(data: CodeExecutionLogData): Promise<string> {
    try {
      const [log] = await db
        .insert(codeExecLogs)
        .values({
          codeAgentId: data.codeAgentId || null,
          workflowExecutionId: data.workflowExecutionId || null,
          nodeId: data.nodeId || null,
          runtime: data.runtime,
          language: data.language,
          durationMs: data.durationMs || null,
          memoryMb: data.memoryMb || null,
          exitCode: data.exitCode || null,
          success: data.success,
          errorMessage: data.errorMessage || null,
          tokensUsed: data.tokensUsed || null,
          validationPassed: data.validationPassed || null,
          organizationId: data.organizationId || null,
          workspaceId: data.workspaceId || null,
          userId: data.userId || null,
        })
        .returning({ id: codeExecLogs.id });

      return log.id;
    } catch (error: any) {
      // Don't throw - logging failures shouldn't break execution
      console.error('Failed to log code execution:', error);
      return '';
    }
  }

  /**
   * Get execution logs for a code agent
   */
  async getAgentLogs(
    codeAgentId: string,
    limit: number = 100
  ): Promise<typeof codeExecLogs.$inferSelect[]> {
    try {
      return await db
        .select()
        .from(codeExecLogs)
        .where(eq(codeExecLogs.codeAgentId, codeAgentId))
        .orderBy(desc(codeExecLogs.createdAt))
        .limit(limit);
    } catch (error: any) {
      console.error('Failed to get agent logs:', error);
      return [];
    }
  }

  /**
   * Get execution logs for a workflow execution
   */
  async getWorkflowExecutionLogs(
    workflowExecutionId: string
  ): Promise<typeof codeExecLogs.$inferSelect[]> {
    try {
      return await db
        .select()
        .from(codeExecLogs)
        .where(eq(codeExecLogs.workflowExecutionId, workflowExecutionId))
        .orderBy(desc(codeExecLogs.createdAt));
    } catch (error: any) {
      console.error('Failed to get workflow execution logs:', error);
      return [];
    }
  }

  /**
   * Get execution statistics for a code agent
   */
  async getAgentStats(codeAgentId: string): Promise<{
    totalExecutions: number;
    successRate: number;
    avgDurationMs: number;
    totalErrors: number;
  }> {
    try {
      const logs = await this.getAgentLogs(codeAgentId, 1000);
      
      const totalExecutions = logs.length;
      const successful = logs.filter(l => l.success).length;
      const totalDuration = logs.reduce((sum, l) => sum + (l.durationMs || 0), 0);
      const totalErrors = logs.filter(l => !l.success).length;

      return {
        totalExecutions,
        successRate: totalExecutions > 0 ? successful / totalExecutions : 0,
        avgDurationMs: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
        totalErrors,
      };
    } catch (error: any) {
      console.error('Failed to get agent stats:', error);
      return {
        totalExecutions: 0,
        successRate: 0,
        avgDurationMs: 0,
        totalErrors: 0,
      };
    }
  }
}

export const codeExecutionLogger = new CodeExecutionLogger();

