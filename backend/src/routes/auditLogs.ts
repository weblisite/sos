import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { auditLogRetentionService } from '../services/auditLogRetentionService';
import { db } from '../config/database';
import { auditLogs, users, organizations, organizationMembers } from '../../drizzle/schema';
import { eq, and, gte, lte, like, or, inArray, desc, sql } from 'drizzle-orm';
import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

// Apply audit logging to all routes (except the audit log routes themselves to avoid recursion)
// Note: We'll apply it selectively to avoid infinite loops

// Get all audit logs with filtering and pagination
router.get('/', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Extract query parameters
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const action = req.query.action as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Build where conditions - only show logs for user's organization
    const conditions: any[] = [eq(auditLogs.organizationId, req.organizationId)];

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    if (action) {
      conditions.push(like(auditLogs.action, `%${action}%`));
    }

    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }

    if (resourceId) {
      conditions.push(eq(auditLogs.resourceId, resourceId));
    }

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    if (search) {
      conditions.push(
        or(
          like(auditLogs.action, `%${search}%`),
          like(auditLogs.resourceType, `%${search}%`),
          like(auditLogs.resourceId, `%${search}%`)
        )!
      );
    }

    // Get audit logs with user information
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: users.email,
        userName: users.name,
        organizationId: auditLogs.organizationId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(...conditions));

    const total = Number(totalResult?.count || 0);

    res.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Export audit logs as CSV (must come before /:id route)
router.get('/export/csv', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Extract query parameters (same as GET /)
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const action = req.query.action as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10000; // Higher limit for export

    // Build where conditions
    const conditions: any[] = [eq(auditLogs.organizationId, req.organizationId)];

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    if (action) {
      conditions.push(like(auditLogs.action, `%${action}%`));
    }

    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }

    if (resourceId) {
      conditions.push(eq(auditLogs.resourceId, resourceId));
    }

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    if (search) {
      conditions.push(
        or(
          like(auditLogs.action, `%${search}%`),
          like(auditLogs.resourceType, `%${search}%`),
          like(auditLogs.resourceId, `%${search}%`)
        )!
      );
    }

    // Get audit logs
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: users.email,
        userName: users.name,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    // Convert to CSV
    const csvHeaders = [
      'Timestamp',
      'User',
      'User Email',
      'Action',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'User Agent',
      'Details',
    ];

    const csvRows = logs.map((log) => [
      log.createdAt.toISOString(),
      log.userName || '',
      log.userEmail || '',
      log.action,
      log.resourceType,
      log.resourceId || '',
      log.ipAddress || '',
      (log.userAgent || '').replace(/,/g, ';'), // Replace commas in user agent
      JSON.stringify(log.details || {}).replace(/,/g, ';'), // Replace commas in details
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get a specific audit log by ID
router.get('/:id', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [log] = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: users.email,
        userName: users.name,
        organizationId: auditLogs.organizationId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(
        and(
          eq(auditLogs.id, req.params.id),
          eq(auditLogs.organizationId, req.organizationId)
        )
      )
      .limit(1);

    if (!log) {
      res.status(404).json({ error: 'Audit log not found' });
      return;
    }

    res.json(log);
  } catch (error: any) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get retention statistics
router.get('/retention/stats', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stats = await auditLogRetentionService.getRetentionStats(req.organizationId);
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting retention stats:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Clean up old logs (dry run)
router.post('/retention/cleanup/dry-run', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const retentionDays = req.body.retentionDays || 90;
    const result = await auditLogRetentionService.cleanupOldLogs({
      retentionDays,
      organizationId: req.organizationId,
      dryRun: true,
    });

    res.json({
      ...result,
      message: `Would delete ${result.deletedCount} logs older than ${retentionDays} days`,
    });
  } catch (error: any) {
    console.error('Error running dry-run cleanup:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Clean up old logs (actual deletion)
router.post('/retention/cleanup', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only allow admins to perform actual cleanup
    // TODO: Add admin check middleware
    // if (!req.user.isAdmin) {
    //   res.status(403).json({ error: 'Forbidden: Admin access required' });
    //   return;
    // }

    const retentionDays = req.body.retentionDays || 90;
    const result = await auditLogRetentionService.cleanupOldLogs({
      retentionDays,
      organizationId: req.organizationId,
      dryRun: false,
    });

    res.json({
      ...result,
      message: `Deleted ${result.deletedCount} logs older than ${retentionDays} days`,
    });
  } catch (error: any) {
    console.error('Error cleaning up old logs:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
