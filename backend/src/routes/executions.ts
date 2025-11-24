import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { workflowExecutor } from '../services/workflowExecutor';
import { replayService } from '../services/replayService';
import { db } from '../config/database';
import { workflowExecutions, executionLogs, executionSteps, workflows, workspaces, organizations, organizationMembers } from '../../drizzle/schema';
import { eq, desc, and } from 'drizzle-orm';
import { CreateWorkflowSchema } from '@sos/shared';
import { getOrCreateDefaultWorkspace } from '../services/workspaceService';
import * as fs from 'fs/promises';
import * as path from 'path';
import redis from '../config/redis';

import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

// Apply audit logging to all routes
router.use(auditLogMiddleware);

// Get executions for a workflow (must come before /:id)
router.get('/workflow/:workflowId', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access to the workflow
    const [workflow] = await db
      .select()
      .from(workflows)
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflows.id, req.params.workflowId),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const executions = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, req.params.workflowId))
      .orderBy(desc(workflowExecutions.startedAt))
      .limit(50);

    res.json(executions);
  } catch (error) {
    console.error('Error fetching executions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Execute workflow
router.post('/execute', authenticate, requirePermission({ resourceType: 'workflow', action: 'execute' }), async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { workflowId, definition, input } = req.body;

    if (!definition) {
      res.status(400).json({ error: 'Workflow definition is required' });
      return;
    }

    // Validate definition
    const validated = CreateWorkflowSchema.parse({
      name: 'temp',
      workspaceId: 'temp',
      definition,
    });

    // If workflowId is 'new' or doesn't exist, create a temporary workflow first
    let actualWorkflowId = workflowId;
    if (!workflowId || workflowId === 'new') {
      // Create a temporary workflow for execution tracking
      const workspaceId = await getOrCreateDefaultWorkspace(req.user.id);
      const [tempWorkflow] = await db
        .insert(workflows)
        .values({
          name: `Temporary Workflow ${new Date().toISOString()}`,
          description: 'Temporary workflow created for execution',
          workspaceId,
          definition: validated.definition as any,
          active: false, // Temporary workflows are inactive
        })
        .returning();
      actualWorkflowId = tempWorkflow.id;
    } else {
      // Verify workflow exists and user has access
      const [workflow] = await db
        .select()
        .from(workflows)
        .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
        .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
        .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
        .where(
          and(
            eq(workflows.id, workflowId),
            eq(organizationMembers.userId, req.user.id)
          )
        )
        .limit(1);

      if (!workflow) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }
    }

    // Get workspaceId from workflow
    const [workflowData] = await db
      .select({ workspaceId: workflows.workspaceId })
      .from(workflows)
      .where(eq(workflows.id, actualWorkflowId))
      .limit(1);

    // Execute workflow (synchronously for now)
    const result = await workflowExecutor.executeWorkflow({
      workflowId: actualWorkflowId,
      definition: validated.definition,
      input: input || {},
      userId: req.user.id,
      organizationId: req.organizationId,
      workspaceId: workflowData?.workspaceId,
    });

    // Always return executionId, even if execution failed
    res.json(result);
  } catch (error) {
    console.error('Error executing workflow:', error);
    // If we get here, it means execution record creation failed
    res.status(500).json({
      error: 'Failed to execute workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get execution by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get execution and verify user has access to the workflow
    const [executionData] = await db
      .select({
        id: workflowExecutions.id,
        workflowId: workflowExecutions.workflowId,
        status: workflowExecutions.status,
        startedAt: workflowExecutions.startedAt,
        finishedAt: workflowExecutions.finishedAt,
        input: workflowExecutions.input,
        output: workflowExecutions.output,
        error: workflowExecutions.error,
        metadata: workflowExecutions.metadata,
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    // Get logs with optional filtering
    const { level, nodeId, limit } = req.query;
    
    // Build where conditions
    const whereConditions: any[] = [eq(executionLogs.executionId, req.params.id)];
    if (level) {
      whereConditions.push(eq(executionLogs.level, level as string));
    }
    if (nodeId) {
      whereConditions.push(eq(executionLogs.nodeId, nodeId as string));
    }

    let logs = await db
      .select()
      .from(executionLogs)
      .where(and(...whereConditions))
      .orderBy(desc(executionLogs.timestamp));

    if (limit) {
      logs = logs.slice(0, parseInt(limit as string, 10));
    }

    // Ensure consistent response format matching frontend expectations
    res.json({
      id: executionData.id,
      workflowId: executionData.workflowId,
      status: executionData.status,
      startedAt: executionData.startedAt,
      finishedAt: executionData.finishedAt,
      input: executionData.input,
      output: executionData.output,
      error: executionData.error,
      metadata: executionData.metadata,
      logs: logs.map((log) => ({
        id: log.id,
        nodeId: log.nodeId,
        level: log.level,
        message: log.message,
        data: log.data,
        timestamp: log.timestamp,
      })),
    });
  } catch (error) {
    console.error('Error fetching execution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resume a paused execution
router.post('/:id/resume', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access to the execution
    const [executionData] = await db
      .select()
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    const modifications = req.body.modifications;
    await workflowExecutor.resumeExecution(req.params.id, modifications);
    res.json({ message: 'Execution resumed' });
  } catch (error: any) {
    console.error('Error resuming execution:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Step to next node in a paused execution
router.post('/:id/step', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access to the execution
    const [executionData] = await db
      .select()
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    await workflowExecutor.stepExecution(req.params.id);
    res.json({ message: 'Stepped to next node' });
  } catch (error: any) {
    console.error('Error stepping execution:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get variable state for a specific node in an execution
router.get('/:id/variables/:nodeId', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access to the execution
    const [executionData] = await db
      .select({
        id: workflowExecutions.id,
        workflowId: workflowExecutions.workflowId,
        status: workflowExecutions.status,
        metadata: workflowExecutions.metadata,
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    const metadata = (executionData.metadata as any) || {};
    const variableSnapshots = metadata.variableSnapshots || {};
    const snapshot = variableSnapshots[req.params.nodeId];

    if (!snapshot) {
      res.status(404).json({ error: 'Variable snapshot not found for this node' });
      return;
    }

    res.json(snapshot);
  } catch (error: any) {
    console.error('Error fetching variable state:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update variable value (for editing during debugging)
router.put('/:id/variables/:nodeId', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access to the execution
    const [executionData] = await db
      .select()
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    // Only allow editing if execution is paused
    if (executionData.status !== 'paused') {
      res.status(400).json({ error: 'Can only edit variables when execution is paused' });
      return;
    }

    const { path, value } = req.body;
    if (!path) {
      res.status(400).json({ error: 'Variable path is required' });
      return;
    }

    const metadata = (executionData.metadata as any) || {};
    if (!metadata.variableSnapshots) {
      metadata.variableSnapshots = {};
    }
    
    const snapshot = metadata.variableSnapshots[req.params.nodeId];
    if (!snapshot) {
      res.status(404).json({ error: 'Variable snapshot not found for this node' });
      return;
    }

    // Update variable value using path (e.g., "output.data.name" or "input.url")
    const pathParts = path.split('.');
    let target: any = snapshot;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (target[pathParts[i]] === undefined) {
        target[pathParts[i]] = {};
      }
      target = target[pathParts[i]];
    }
    target[pathParts[pathParts.length - 1]] = value;

    // Update snapshot timestamp
    snapshot.timestamp = new Date();

    // Save updated metadata
    await db.update(workflowExecutions).set({
      metadata: metadata,
    }).where(eq(workflowExecutions.id, req.params.id));

    res.json({ message: 'Variable updated', snapshot });
  } catch (error: any) {
    console.error('Error updating variable:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Export execution logs
router.get('/:id/export', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { format = 'json' } = req.query;

    // Verify user has access
    const [executionData] = await db
      .select({
        id: workflowExecutions.id,
        workflowId: workflowExecutions.workflowId,
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    // Get execution with logs
    const [execution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, id))
      .limit(1);

    const logs = await db
      .select()
      .from(executionLogs)
      .where(eq(executionLogs.executionId, id))
      .orderBy(executionLogs.timestamp);

    const exportData = {
      execution: {
        id: execution?.id,
        workflowId: execution?.workflowId,
        status: execution?.status,
        startedAt: execution?.startedAt,
        finishedAt: execution?.finishedAt,
        input: execution?.input,
        output: execution?.output,
        error: execution?.error,
      },
      logs: logs.map((log) => ({
        nodeId: log.nodeId,
        level: log.level,
        message: log.message,
        data: log.data,
        timestamp: log.timestamp,
      })),
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="execution-${id}.json"`);
      res.json(exportData);
    } else if (format === 'csv') {
      // Convert to CSV
      const csvRows: string[] = [];
      csvRows.push('Timestamp,Node ID,Level,Message,Data');
      logs.forEach((log) => {
        const dataStr = log.data ? JSON.stringify(log.data).replace(/"/g, '""') : '';
        csvRows.push(
          `"${log.timestamp}","${log.nodeId}","${log.level}","${log.message.replace(/"/g, '""')}","${dataStr}"`
        );
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="execution-${id}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      res.status(400).json({ error: 'Invalid format. Use "json" or "csv"' });
    }
  } catch (error) {
    console.error('Error exporting execution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get execution steps
router.get('/:id/steps', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access
    const [executionData] = await db
      .select()
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    const steps = await replayService.getExecutionSteps(req.params.id);
    res.json(steps);
  } catch (error: any) {
    console.error('Error fetching execution steps:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get specific step
router.get('/:id/steps/:stepId', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access
    const [executionData] = await db
      .select()
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    const step = await replayService.getStep(req.params.stepId);
    if (!step || step.executionId !== req.params.id) {
      res.status(404).json({ error: 'Step not found' });
      return;
    }

    res.json(step);
  } catch (error: any) {
    console.error('Error fetching step:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Replay entire execution
router.post('/:id/replay', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access
    const [executionData] = await db
      .select()
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    const options = req.body.options || {};
    const newExecutionId = await replayService.replayExecution(req.params.id, options);
    res.json({ executionId: newExecutionId, message: 'Execution replayed' });
  } catch (error: any) {
    console.error('Error replaying execution:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Replay from specific step
router.post('/:id/replay/:stepId', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access
    const [executionData] = await db
      .select()
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    const options = req.body.options || {};
    const newExecutionId = await replayService.replayFromStep(
      req.params.id,
      req.params.stepId,
      options
    );
    res.json({ executionId: newExecutionId, message: 'Execution replayed from step' });
  } catch (error: any) {
    console.error('Error replaying execution from step:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Submit human prompt response
router.post('/:id/human-prompt/:nodeId/respond', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify user has access
    const [executionData] = await db
      .select()
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(
        and(
          eq(workflowExecutions.id, req.params.id),
          eq(organizationMembers.userId, req.user.id)
        )
      )
      .limit(1);

    if (!executionData) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    const { response } = req.body;
    if (!response) {
      res.status(400).json({ error: 'Response is required' });
      return;
    }

    // Publish response via Redis
    await redis.publish(
      `execution:${req.params.id}:human-prompt:${req.params.nodeId}`,
      JSON.stringify(response)
    );

    // Resume execution
    await workflowExecutor.resumeExecution(req.params.id);

    res.json({ message: 'Response received, execution resumed' });
  } catch (error: any) {
    console.error('Error submitting human prompt response:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

