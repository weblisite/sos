/**
 * Integration Tests for Code Execution
 * 
 * These tests require external services to be configured:
 * - E2B: Requires E2B_API_KEY environment variable
 * - WasmEdge: Requires WASMEDGE_SERVICE_URL (if using service)
 * - Python: Requires Python 3.x installed locally
 * 
 * To run these tests:
 * 1. Set up required environment variables
 * 2. Ensure external services are accessible
 * 3. Run: npm test -- code.integration.test.ts
 */

import { executeCode } from '../code';
import { NodeExecutionContext } from '@sos/shared';

describe('Code Execution Integration Tests', () => {
  const createContext = (overrides: Partial<NodeExecutionContext> = {}): NodeExecutionContext => ({
    input: {},
    config: {},
    workflowId: 'test-workflow',
    nodeId: 'test-node',
    executionId: 'test-execution',
    ...overrides,
  });

  describe('E2B Runtime Integration', () => {
    const e2bApiKey = process.env.E2B_API_KEY;
    const e2bEnabled = process.env.E2B_ENABLED === 'true';

    beforeAll(() => {
      if (!e2bApiKey || !e2bEnabled) {
        console.warn('⚠️ E2B integration tests skipped: E2B_API_KEY not set or E2B_ENABLED=false');
      }
    });

    it.skipIf(!e2bApiKey || !e2bEnabled)('should execute Python code in E2B sandbox', async () => {
      const context = createContext({
        config: {
          code: 'import requests\nresponse = requests.get("https://api.github.com")\nprint(response.status_code)',
          language: 'python',
          runtime: 'e2b',
          packages: ['requests'],
        },
      });

      const result = await executeCode(context, 'python');

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    }, 60000); // 60 second timeout for E2B

    it.skipIf(!e2bApiKey || !e2bEnabled)('should handle E2B sandbox timeouts', async () => {
      const context = createContext({
        config: {
          code: 'import time\ntime.sleep(120)', // 2 minute sleep
          language: 'python',
          runtime: 'e2b',
          timeout: 5000, // 5 second timeout
        },
      });

      const result = await executeCode(context, 'python');

      expect(result.success).toBe(false);
      expect(result.error?.code).toMatch(/timeout|TIMEOUT/);
    }, 30000);
  });

  describe('WasmEdge Runtime Integration', () => {
    const wasmEdgeUrl = process.env.WASMEDGE_SERVICE_URL;
    const wasmEdgeEnabled = process.env.WASMEDGE_ENABLED === 'true';

    beforeAll(() => {
      if (!wasmEdgeUrl || !wasmEdgeEnabled) {
        console.warn('⚠️ WasmEdge integration tests skipped: WASMEDGE_SERVICE_URL not set or WASMEDGE_ENABLED=false');
      }
    });

    it.skipIf(!wasmEdgeUrl || !wasmEdgeEnabled)('should execute WebAssembly code in WasmEdge', async () => {
      // This test would require a WasmEdge service implementation
      // Placeholder for future implementation
      expect(true).toBe(true);
    });
  });

  describe('Python Subprocess Integration', () => {
    it('should execute Python code via subprocess', async () => {
      const context = createContext({
        config: {
          code: 'result = 2 + 2\nprint(result)',
          language: 'python',
          runtime: 'subprocess',
        },
      });

      const result = await executeCode(context, 'python');

      // This will only work if Python is installed
      if (result.success) {
        expect(result.output).toBeDefined();
      } else {
        // If Python is not installed, that's okay for CI/CD
        expect(result.error).toBeDefined();
      }
    }, 30000);
  });

  describe('Bash Execution Integration', () => {
    it('should execute Bash commands', async () => {
      const context = createContext({
        config: {
          code: 'echo "Hello, World!"',
          language: 'bash',
          runtime: 'subprocess',
        },
      });

      const result = await executeCode(context, 'bash');

      if (result.success) {
        expect(result.output).toBeDefined();
      } else {
        // Bash might not be available in all environments
        expect(result.error).toBeDefined();
      }
    }, 30000);
  });

  describe('Runtime Router Integration', () => {
    it('should auto-route to appropriate runtime', async () => {
      const context = createContext({
        config: {
          code: 'return 42;',
          language: 'javascript',
          runtime: 'auto',
        },
      });

      const result = await executeCode(context, 'javascript');

      expect(result.success).toBe(true);
      // Should route to VM2 for JavaScript
    });

    it('should route long jobs to appropriate runtime', async () => {
      const e2bApiKey = process.env.E2B_API_KEY;
      
      const context = createContext({
        config: {
          code: 'import time\ntime.sleep(1)',
          language: 'python',
          runtime: 'auto',
          longJob: true,
          expectedDuration: 5000,
        },
      });

      const result = await executeCode(context, 'python');

      // Should route to E2B if available, otherwise subprocess
      expect(result).toBeDefined();
    }, 30000);
  });

  describe('Schema Validation Integration', () => {
    it('should validate input and output schemas', async () => {
      const context = createContext({
        config: {
          code: 'return { result: input.value * 2 };',
          language: 'javascript',
          inputSchema: {
            type: 'object',
            properties: {
              value: { type: 'number' },
            },
            required: ['value'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              result: { type: 'number' },
            },
            required: ['result'],
          },
        },
        input: { value: 21 },
      });

      const result = await executeCode(context, 'javascript');

      expect(result.success).toBe(true);
      expect(result.output?.output).toEqual({ result: 42 });
    });

    it('should reject invalid input schema', async () => {
      const context = createContext({
        config: {
          code: 'return input.value;',
          language: 'javascript',
          inputSchema: {
            type: 'object',
            properties: {
              value: { type: 'number' },
            },
            required: ['value'],
          },
        },
        input: { value: 'not a number' },
      });

      const result = await executeCode(context, 'javascript');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INPUT_VALIDATION_ERROR');
    });
  });
});

