import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { auditLogMiddleware } from '../middleware/auditLog';
import { observabilityService } from '../services/observabilityService';
import { db } from '../config/database';
import { eventLogs } from '../../drizzle/schema';
import { eq, gte, and, desc } from 'drizzle-orm';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(setOrganization);
router.use(auditLogMiddleware);

/**
 * Get system metrics
 * GET /api/v1/observability/metrics?range=24h
 */
router.get('/metrics', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { range = '24h', workspaceId } = req.query;

    // Get metrics from observability service (database-backed)
    const metrics = await observabilityService.getSystemMetrics(
      range as string,
      req.user?.id,
      (workspaceId as string) || undefined
    );
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching observability metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get error logs
 * GET /api/v1/observability/errors?range=24h
 */
router.get('/errors', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { range = '24h', workspaceId } = req.query;

    // Get error logs from observability service (database-backed)
    const errorLogs = await observabilityService.getErrorLogs(
      range as string,
      req.user?.id,
      (workspaceId as string) || undefined
    );
    res.json(errorLogs);
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/observability/traces
 * Get list of traces
 */
router.get('/traces', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { range = '24h', workspaceId, userId } = req.query;
    const user = req.user;

    // Calculate cutoff date
    const cutoffDate = new Date();
    switch (range) {
      case '1h':
        cutoffDate.setHours(cutoffDate.getHours() - 1);
        break;
      case '24h':
        cutoffDate.setHours(cutoffDate.getHours() - 24);
        break;
      case '7d':
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case '30d':
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        break;
    }

    // Build query conditions
    const conditions = [
      gte(eventLogs.timestamp, cutoffDate),
      eq(eventLogs.eventType, 'agent_execution'),
    ];

    if (workspaceId) {
      conditions.push(eq(eventLogs.workspaceId, workspaceId as string));
    } else if (user.workspaceId) {
      conditions.push(eq(eventLogs.workspaceId, user.workspaceId));
    }

    if (userId) {
      conditions.push(eq(eventLogs.userId, userId as string));
    } else if (user.id) {
      conditions.push(eq(eventLogs.userId, user.id));
    }

    // Query traces from event_logs
    const events = await db
      .select()
      .from(eventLogs)
      .where(and(...conditions))
      .orderBy(desc(eventLogs.timestamp))
      .limit(100);

    // Transform events to traces
    const traces = events.map((event) => {
      const context = (event.context as any) || {};
      const startTime = event.timestamp;
      const endTime = event.timestamp;
      const duration = event.latencyMs || 0;

      return {
        id: event.traceId || event.id,
        name: `Agent Execution: ${context.framework || 'unknown'}`,
        userId: event.userId || undefined,
        sessionId: context.executionId || undefined,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration,
        status: event.status === 'success' ? 'success' : 'error',
        metadata: {
          framework: context.framework,
          agentId: context.agentId,
          executionId: context.executionId,
        },
        cost: context.cost,
        tokens: context.tokensUsed
          ? {
              total: context.tokensUsed,
              prompt: Math.floor(context.tokensUsed * 0.7),
              completion: Math.floor(context.tokensUsed * 0.3),
            }
          : undefined,
      };
    });

    res.json({ traces });
  } catch (error: any) {
    console.error('Error fetching traces:', error);
    res.status(500).json({ message: 'Failed to fetch traces', error: error.message });
  }
});

/**
 * GET /api/v1/observability/traces/:traceId
 * Get specific trace details
 */
router.get('/traces/:traceId', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { traceId } = req.params;
    const user = req.user;

    // Query all events for this trace
    const conditions = [eq(eventLogs.traceId, traceId)];

    if (user.workspaceId) {
      conditions.push(eq(eventLogs.workspaceId, user.workspaceId));
    }

    const events = await db
      .select()
      .from(eventLogs)
      .where(and(...conditions))
      .orderBy(eventLogs.timestamp);

    if (events.length === 0) {
      return res.status(404).json({ message: 'Trace not found' });
    }

    // Find the main agent execution event
    const mainEvent = events.find((e) => e.eventType === 'agent_execution') || events[0];
    const context = (mainEvent.context as any) || {};

    // Build trace object
    const trace = {
      id: traceId,
      name: `Agent Execution: ${context.framework || 'unknown'}`,
      userId: mainEvent.userId || undefined,
      sessionId: context.executionId || undefined,
      startTime: mainEvent.timestamp.toISOString(),
      endTime: mainEvent.timestamp.toISOString(),
      duration: mainEvent.latencyMs || 0,
      status: mainEvent.status === 'success' ? 'success' : 'error',
      metadata: {
        framework: context.framework,
        agentId: context.agentId,
        executionId: context.executionId,
        query: context.query,
      },
      input: context.query ? { query: context.query } : undefined,
      output: {
        success: mainEvent.status === 'success',
        error: context.error,
      },
      cost: context.cost,
      tokens: context.tokensUsed
        ? {
            total: context.tokensUsed,
            prompt: Math.floor(context.tokensUsed * 0.7),
            completion: Math.floor(context.tokensUsed * 0.3),
          }
        : undefined,
      spans: events
        .filter((e) => e.eventType !== 'agent_execution')
        .map((event) => {
          const eventContext = (event.context as any) || {};
          return {
            id: event.id,
            name: event.eventType,
            startTime: event.timestamp.toISOString(),
            endTime: event.timestamp.toISOString(),
            duration: event.latencyMs || 0,
            status: event.status === 'success' ? 'success' : 'error',
            attributes: eventContext,
          };
        }),
    };

    res.json(trace);
  } catch (error: any) {
    console.error('Error fetching trace:', error);
    res.status(500).json({ message: 'Failed to fetch trace', error: error.message });
  }
});

export default router;

