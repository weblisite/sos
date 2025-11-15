/**
 * Integration Tests for Code Agent Registry
 * 
 * These tests require:
 * - Database connection (PostgreSQL)
 * - Supabase Storage (for large code blobs)
 * 
 * To run these tests:
 * 1. Set up test database
 * 2. Configure Supabase Storage credentials
 * 3. Run: npm test -- codeAgentRegistry.integration.test.ts
 */

import { codeAgentRegistry } from '../codeAgentRegistry';
import { db } from '../../config/database';
import { codeAgents, codeAgentVersions } from '../../../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Code Agent Registry Integration Tests', () => {
  let testAgentId: string;
  const testOrgId = 'test-org-integration';
  const testWorkspaceId = 'test-workspace-integration';
  const testUserId = 'test-user-integration';

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(codeAgentVersions).where(eq(codeAgentVersions.codeAgentId, 'test-agent'));
    await db.delete(codeAgents).where(eq(codeAgents.id, 'test-agent'));
  });

  afterAll(async () => {
    // Clean up test data
    if (testAgentId) {
      await db.delete(codeAgentVersions).where(eq(codeAgentVersions.codeAgentId, testAgentId));
      await db.delete(codeAgents).where(eq(codeAgents.id, testAgentId));
    }
  });

  describe('Agent CRUD Operations', () => {
    it('should create a new code agent', async () => {
      const agent = await codeAgentRegistry.createAgent({
        name: 'Test Integration Agent',
        description: 'Test agent for integration tests',
        language: 'javascript',
        code: 'return input.value * 2;',
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('Test Integration Agent');
      expect(agent.version).toBe('1.0.0');

      testAgentId = agent.id;
    });

    it('should retrieve the created agent', async () => {
      if (!testAgentId) {
        throw new Error('Test agent ID not set');
      }

      const agent = await codeAgentRegistry.getAgent(testAgentId);

      expect(agent).toBeDefined();
      expect(agent?.id).toBe(testAgentId);
      expect(agent?.name).toBe('Test Integration Agent');
    });

    it('should update agent and create new version', async () => {
      if (!testAgentId) {
        throw new Error('Test agent ID not set');
      }

      const updatedAgent = await codeAgentRegistry.updateAgent(testAgentId, {
        code: 'return input.value * 3;',
        changelog: [{ changes: 'Updated multiplier from 2 to 3' }],
      });

      expect(updatedAgent).toBeDefined();
      expect(updatedAgent.version).toBe('1.1.0');

      // Verify version history
      const versions = await codeAgentRegistry.getVersions(testAgentId);
      expect(versions.length).toBeGreaterThan(0);
    });

    it('should list agents with filters', async () => {
      const agents = await codeAgentRegistry.listAgents({
        language: 'javascript',
        organizationId: testOrgId,
      });

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should delete the test agent', async () => {
      if (!testAgentId) {
        throw new Error('Test agent ID not set');
      }

      await codeAgentRegistry.deleteAgent(testAgentId);

      const agent = await codeAgentRegistry.getAgent(testAgentId);
      expect(agent).toBeNull();
    });
  });

  describe('Supabase Storage Integration', () => {
    it.skip('should store large code in Supabase Storage', async () => {
      // This test requires Supabase Storage to be configured
      const largeCode = 'x'.repeat(100000); // 100KB

      const agent = await codeAgentRegistry.createAgent({
        name: 'Large Code Agent',
        language: 'javascript',
        code: largeCode,
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      expect(agent.codeStoragePath).toBeDefined();
      expect(agent.code).toContain('Supabase Storage');

      // Clean up
      await codeAgentRegistry.deleteAgent(agent.id);
    });
  });

  describe('Version Management', () => {
    let versionedAgentId: string;

    beforeAll(async () => {
      const agent = await codeAgentRegistry.createAgent({
        name: 'Versioned Agent',
        language: 'javascript',
        code: 'return 1;',
        organizationId: testOrgId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });
      versionedAgentId = agent.id;
    });

    afterAll(async () => {
      if (versionedAgentId) {
        await codeAgentRegistry.deleteAgent(versionedAgentId);
      }
    });

    it('should create multiple versions', async () => {
      await codeAgentRegistry.updateAgent(versionedAgentId, {
        code: 'return 2;',
        changelog: [{ changes: 'Version 2' }],
      });

      await codeAgentRegistry.updateAgent(versionedAgentId, {
        code: 'return 3;',
        changelog: [{ changes: 'Version 3' }],
      });

      const versions = await codeAgentRegistry.getVersions(versionedAgentId);
      expect(versions.length).toBeGreaterThanOrEqual(3);
    });

    it('should retrieve specific version', async () => {
      const agent = await codeAgentRegistry.getAgent(versionedAgentId, '1.0.0');
      expect(agent).toBeDefined();
      expect(agent?.version).toBe('1.0.0');
    });
  });
});

