import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { connectorRegistry } from '../services/connectors/registry';
import { ConnectorManifest } from '../services/connectors/types';
import { db } from '../config/database';
import { connectorCredentials, organizations, organizationMembers } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { encryptObject, decryptObject } from '../utils/encryption';
import { createId } from '@paralleldrive/cuid2';
import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

// Apply audit logging to all routes
router.use(auditLogMiddleware);

// List all connectors
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { category } = req.query;
    // Ensure database connectors are loaded
    await connectorRegistry.loadFromDatabase();
    const connectors = connectorRegistry.list(category as string);
    res.json(connectors);
  } catch (error: any) {
    console.error('Error listing connectors:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get connector categories
router.get('/categories', authenticate, async (req: AuthRequest, res) => {
  try {
    // Ensure database connectors are loaded
    await connectorRegistry.loadFromDatabase();
    const connectors = connectorRegistry.list();
    
    // Extract unique categories from connectors
    const categories = new Set<string>();
    connectors.forEach((connector) => {
      if (connector.category) {
        categories.add(connector.category);
      }
    });
    
    // Get count of connectors per category
    const categoryStats = Array.from(categories).map((category) => {
      const count = connectors.filter((c) => c.category === category).length;
      return {
        id: category,
        name: category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' '),
        count,
      };
    });
    
    // Sort by count (descending)
    categoryStats.sort((a, b) => b.count - a.count);
    
    res.json({
      categories: categoryStats,
      total: connectors.length,
    });
  } catch (error: any) {
    console.error('Error fetching connector categories:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get connector by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const connector = connectorRegistry.get(req.params.id);
    if (!connector) {
      res.status(404).json({ error: 'Connector not found' });
      return;
    }
    res.json(connector);
  } catch (error: any) {
    console.error('Error getting connector:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Execute connector action
router.post('/:id/actions/:actionId/execute', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { input } = req.body;
    const connectorId = req.params.id;
    const actionId = req.params.actionId;

    // Get credentials for this connector
    const [credential] = await db
      .select()
      .from(connectorCredentials)
      .where(
        and(
          eq(connectorCredentials.userId, req.user.id),
          eq(connectorCredentials.connectorId, connectorId)
        )
      )
      .limit(1);

    if (!credential) {
      res.status(404).json({ error: 'Connector not connected. Please connect the connector first.' });
      return;
    }

    // Decrypt credentials
    let credentials: Record<string, unknown>;
    try {
      if (typeof credential.credentials === 'string') {
        credentials = decryptObject(credential.credentials);
      } else {
        credentials = credential.credentials as Record<string, unknown>;
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to decrypt credentials' });
      return;
    }

    // Execute action
    const result = await connectorRegistry.execute(connectorId, {
      actionId,
      input: input || {},
      credentials,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error executing connector action:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// List user's connector credentials
router.get('/credentials', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const credentials = await db
      .select({
        id: connectorCredentials.id,
        connectorId: connectorCredentials.connectorId,
        createdAt: connectorCredentials.createdAt,
        updatedAt: connectorCredentials.updatedAt,
        expiresAt: connectorCredentials.expiresAt,
      })
      .from(connectorCredentials)
      .where(eq(connectorCredentials.userId, req.user.id));

    res.json(credentials);
  } catch (error: any) {
    console.error('Error listing credentials:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get connection statuses (alias for credentials)
router.get('/connections', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const credentials = await db
      .select({
        connectorId: connectorCredentials.connectorId,
        connectedAt: connectorCredentials.createdAt,
      })
      .from(connectorCredentials)
      .where(eq(connectorCredentials.userId, req.user.id));

    res.json(credentials);
  } catch (error: any) {
    console.error('Error listing connections:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Initiate OAuth connection flow
router.post('/:id/connect', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const connectorId = req.params.id;
    const connector = connectorRegistry.get(connectorId);

    if (!connector) {
      res.status(404).json({ error: 'Connector not found' });
      return;
    }

    // If using Nango OAuth
    if (connector.oauthProvider === 'nango') {
      const { nangoService } = await import('../services/nangoService');
      const result = await nangoService.initiateOAuth(
        connectorId,
        req.user.id,
        req.organizationId || '',
        undefined // connectionId
      );
      res.json({ authUrl: result.authUrl });
    } else {
      // For API key or connection string connectors, return instructions
      res.json({
        requiresManualSetup: true,
        authType: connector.auth.type,
        message: 'Please configure credentials manually',
      });
    }
  } catch (error: any) {
    console.error('Error initiating connection:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Disconnect connector
router.post('/:id/disconnect', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const connectorId = req.params.id;

    // Find and delete credential
    const [credential] = await db
      .select()
      .from(connectorCredentials)
      .where(
        and(
          eq(connectorCredentials.userId, req.user.id),
          eq(connectorCredentials.connectorId, connectorId)
        )
      )
      .limit(1);

    if (!credential) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    await db
      .delete(connectorCredentials)
      .where(eq(connectorCredentials.id, credential.id));

    res.json({ message: 'Disconnected successfully' });
  } catch (error: any) {
    console.error('Error disconnecting:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Revoke connector credentials
router.delete('/credentials/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify ownership
    const [credential] = await db
      .select()
      .from(connectorCredentials)
      .where(
        and(
          eq(connectorCredentials.id, req.params.id),
          eq(connectorCredentials.userId, req.user.id)
        )
      )
      .limit(1);

    if (!credential) {
      res.status(404).json({ error: 'Credential not found' });
      return;
    }

    await db
      .delete(connectorCredentials)
      .where(eq(connectorCredentials.id, req.params.id));

    res.json({ message: 'Credentials revoked' });
  } catch (error: any) {
    console.error('Error revoking credentials:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Store connector credentials (for OAuth callback or manual setup)
router.post('/credentials', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { connectorId, credentials, expiresAt } = req.body;

    if (!connectorId || !credentials) {
      res.status(400).json({ error: 'connectorId and credentials are required' });
      return;
    }

    // Encrypt credentials
    const encryptedCredentials = encryptObject(credentials);

    // Check if credential already exists
    const [existing] = await db
      .select()
      .from(connectorCredentials)
      .where(
        and(
          eq(connectorCredentials.userId, req.user.id),
          eq(connectorCredentials.connectorId, connectorId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(connectorCredentials)
        .set({
          credentials: encryptedCredentials as any,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          updatedAt: new Date(),
        })
        .where(eq(connectorCredentials.id, existing.id));

      res.json({ id: existing.id, message: 'Credentials updated' });
    } else {
      // Create new
      const [newCredential] = await db
        .insert(connectorCredentials)
        .values({
          userId: req.user.id,
          organizationId: req.organizationId || null,
          connectorId,
          credentials: encryptedCredentials as any,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        })
        .returning();

      res.json({ id: newCredential.id, message: 'Credentials stored' });
    }
  } catch (error: any) {
    console.error('Error storing credentials:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Register a custom connector
router.post('/register', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const manifest: ConnectorManifest = req.body.manifest;
    const version = req.body.version;

    if (!manifest || !manifest.id) {
      res.status(400).json({ error: 'Invalid connector manifest' });
      return;
    }

    // Validate manifest structure
    if (!manifest.name || !manifest.category || !manifest.actions) {
      res.status(400).json({ error: 'Manifest must include name, category, and actions' });
      return;
    }

    connectorRegistry.registerCustom(manifest, version);
    res.json({ message: 'Connector registered successfully', connectorId: manifest.id });
  } catch (error: any) {
    console.error('Error registering connector:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update a connector (versioning)
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const connectorId = req.params.id;
    const manifest: ConnectorManifest = req.body.manifest;

    if (!manifest || manifest.id !== connectorId) {
      res.status(400).json({ error: 'Invalid connector manifest or ID mismatch' });
      return;
    }

    const updated = connectorRegistry.updateConnector(connectorId, manifest);
    if (!updated) {
      res.status(404).json({ error: 'Connector not found or version unchanged' });
      return;
    }

    res.json({ message: 'Connector updated successfully', connectorId, version: manifest.version });
  } catch (error: any) {
    console.error('Error updating connector:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Unregister a custom connector
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const connectorId = req.params.id;

    // Only allow unregistering custom connectors
    if (!connectorRegistry.isCustom(connectorId)) {
      res.status(403).json({ error: 'Cannot unregister built-in connectors' });
      return;
    }

    const removed = connectorRegistry.unregisterCustom(connectorId);
    if (!removed) {
      res.status(404).json({ error: 'Custom connector not found' });
      return;
    }

    res.json({ message: 'Connector unregistered successfully', connectorId });
  } catch (error: any) {
    console.error('Error unregistering connector:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

