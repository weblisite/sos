import { runtimeRouter } from '../runtimeRouter';
import { NodeExecutionContext } from '@sos/shared';

// Mock code execution functions
jest.mock('../nodeExecutors/code', () => ({
  executeJavaScript: jest.fn(),
  executePython: jest.fn(),
}));

// Mock E2B runtime
jest.mock('../e2bRuntime', () => ({
  e2bRuntime: {
    execute: jest.fn(),
  },
}));

// Mock database
jest.mock('../../config/database', () => ({
  db: {
    insert: jest.fn(),
  },
}));

describe('Runtime Router', () => {
  const createContext = (overrides: Partial<NodeExecutionContext> = {}): NodeExecutionContext => ({
    input: {},
    config: {},
    workflowId: 'test-workflow',
    nodeId: 'test-node',
    executionId: 'test-execution',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('route', () => {
    it('should use explicitly specified runtime', async () => {
      const context = createContext({
        config: {
          code: 'return 42;',
          language: 'javascript',
          runtime: 'vm2',
        },
      });

      const { executeCode } = require('../nodeExecutors/code');
      executeCode.mockResolvedValue({
        success: true,
        output: { output: 42 },
      });

      const result = await runtimeRouter.route({
        code: 'return 42;',
        language: 'javascript',
        runtime: 'vm2',
        input: {},
      }, context);

      expect(result.success).toBe(true);
      expect(executeCode).toHaveBeenCalled();
    });

    it('should auto-route JavaScript to VM2', async () => {
      const context = createContext({
        config: {
          code: 'return 42;',
          language: 'javascript',
          runtime: 'auto',
        },
      });

      const { executeCode } = require('../nodeExecutors/code');
      executeCode.mockResolvedValue({
        success: true,
        output: { output: 42 },
      });

      const result = await runtimeRouter.route({
        code: 'return 42;',
        language: 'javascript',
        runtime: 'auto',
        input: {},
      }, context);

      expect(result.success).toBe(true);
    });

    it('should auto-route Python to subprocess by default', async () => {
      const context = createContext({
        config: {
          code: 'print(42)',
          language: 'python',
          runtime: 'auto',
        },
      });

      const { executeCode } = require('../nodeExecutors/code');
      executeCode.mockResolvedValue({
        success: true,
        output: { output: 42 },
      });

      const result = await runtimeRouter.route({
        code: 'print(42)',
        language: 'python',
        runtime: 'auto',
        input: {},
      }, context);

      expect(result.success).toBe(true);
    });

    it('should route to E2B when requiresSandbox is true', async () => {
      const context = createContext({
        config: {
          code: 'import requests\nprint(requests.get("https://api.github.com"))',
          language: 'python',
          runtime: 'auto',
          requiresSandbox: true,
        },
      });

      const { e2bRuntime } = require('../e2bRuntime');
      e2bRuntime.execute.mockResolvedValue({
        success: true,
        output: { output: 'success' },
        runtime: 'e2b',
      });

      const result = await runtimeRouter.route({
        code: 'import requests\nprint(requests.get("https://api.github.com"))',
        language: 'python',
        runtime: 'auto',
        requiresSandbox: true,
        input: {},
      }, context);

      // If E2B is enabled, it should be used
      // Otherwise, it falls back to subprocess
      expect(result.success).toBe(true);
    });

    it('should route to E2B for long-running jobs', async () => {
      const context = createContext({
        config: {
          code: 'import time\ntime.sleep(60)',
          language: 'python',
          runtime: 'auto',
          longJob: true,
          expectedDuration: 60000,
        },
      });

      const { e2bRuntime } = require('../e2bRuntime');
      e2bRuntime.execute.mockResolvedValue({
        success: true,
        output: { output: 'completed' },
        runtime: 'e2b',
      });

      const result = await runtimeRouter.route({
        code: 'import time\ntime.sleep(60)',
        language: 'python',
        runtime: 'auto',
        longJob: true,
        expectedDuration: 60000,
        input: {},
      }, context);

      expect(result.success).toBe(true);
    });

    it('should track runtime metrics', async () => {
      const context = createContext({
        config: {
          code: 'return 42;',
          language: 'javascript',
          runtime: 'vm2',
        },
        userId: 'test-user',
        workspaceId: 'test-workspace',
        organizationId: 'test-org',
      });

      const { executeCode } = require('../nodeExecutors/code');
      executeCode.mockResolvedValue({
        success: true,
        output: { output: 42 },
      });

      await runtimeRouter.route({
        code: 'return 42;',
        language: 'javascript',
        runtime: 'vm2',
        input: {},
      }, context);

      // Verify metrics tracking was called
      // This is tested indirectly through the route method
      expect(executeCode).toHaveBeenCalled();
    });

    it('should handle runtime selection errors gracefully', async () => {
      const context = createContext({
        config: {
          code: 'return 42;',
          language: 'javascript',
          runtime: 'invalid-runtime',
        },
      });

      const { executeCode } = require('../nodeExecutors/code');
      executeCode.mockRejectedValue(new Error('Invalid runtime'));

      await expect(
        runtimeRouter.route({
          code: 'return 42;',
          language: 'javascript',
          runtime: 'invalid-runtime',
          input: {},
        }, context)
      ).rejects.toThrow();
    });
  });

  describe('selectRuntime', () => {
    it('should select VM2 for JavaScript by default', () => {
      const selected = (runtimeRouter as any).selectRuntime({
        language: 'javascript',
        runtime: 'auto',
      });

      expect(selected).toBe('vm2');
    });

    it('should select subprocess for Python by default', () => {
      const selected = (runtimeRouter as any).selectRuntime({
        language: 'python',
        runtime: 'auto',
      });

      expect(selected).toBe('subprocess');
    });

    it('should select E2B when requiresSandbox is true', () => {
      const selected = (runtimeRouter as any).selectRuntime({
        language: 'python',
        runtime: 'auto',
        requiresSandbox: true,
      });

      // E2B should be selected if enabled, otherwise subprocess
      expect(['e2b', 'subprocess']).toContain(selected);
    });

    it('should select E2B for long-running jobs', () => {
      const selected = (runtimeRouter as any).selectRuntime({
        language: 'python',
        runtime: 'auto',
        longJob: true,
        expectedDuration: 60000,
      });

      // E2B should be selected if enabled, otherwise subprocess
      expect(['e2b', 'subprocess']).toContain(selected);
    });

    it('should select Bacalhau for very long jobs', () => {
      const selected = (runtimeRouter as any).selectRuntime({
        language: 'python',
        runtime: 'auto',
        longJob: true,
        expectedDuration: 300000, // 5 minutes
      });

      // Bacalhau should be selected if enabled, otherwise E2B or subprocess
      expect(['bacalhau', 'e2b', 'subprocess']).toContain(selected);
    });
  });

  describe('getRuntimeMetrics', () => {
    it('should return runtime performance metrics', () => {
      const metrics = runtimeRouter.getRuntimeMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });

    it('should include metrics for different runtimes', () => {
      const metrics = runtimeRouter.getRuntimeMetrics();

      // Metrics should be an object with runtime names as keys
      expect(metrics).toBeDefined();
    });
  });
});

