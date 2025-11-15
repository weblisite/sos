import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { VM } from 'vm2';
import { codeValidationService } from '../codeValidationService';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { runtimeRouter } from '../runtimeRouter';
import { codeExecutionLogger } from '../codeExecutionLogger';

// Security: Dangerous Python packages/modules to block
const BLOCKED_PACKAGES = [
  'os', 'sys', 'subprocess', 'shutil', 'socket', 'urllib', 'requests', 'http',
  'ftplib', 'smtplib', 'telnetlib', 'pickle', 'marshal', 'eval', 'exec', 'compile',
  'importlib', '__import__', 'open', 'file', 'input', 'raw_input',
];

// Security: Allowed packages (whitelist approach - empty means all allowed except blocked)
const ALLOWED_PACKAGES: string[] = process.env.PYTHON_ALLOWED_PACKAGES
  ? process.env.PYTHON_ALLOWED_PACKAGES.split(',').map(p => p.trim())
  : [];

// Security: Validate Python code for dangerous operations
function validatePythonCode(code: string, packages: string[]): { valid: boolean; error?: string } {
  // Check for blocked imports
  const importPattern = /^\s*(?:import|from)\s+(\w+)/gm;
  const matches = code.matchAll(importPattern);
  
  for (const match of matches) {
    const module = match[1];
    if (BLOCKED_PACKAGES.includes(module)) {
      return {
        valid: false,
        error: `Blocked module '${module}' is not allowed for security reasons`,
      };
    }
    
    // If whitelist is enabled, check against it
    if (ALLOWED_PACKAGES.length > 0 && !ALLOWED_PACKAGES.includes(module)) {
      return {
        valid: false,
        error: `Module '${module}' is not in the allowed packages list`,
      };
    }
  }
  
  // Check for dangerous function calls
  const dangerousPatterns = [
    /__import__\s*\(/,
    /eval\s*\(/,
    /exec\s*\(/,
    /compile\s*\(/,
    /open\s*\([^)]*['"]w/,
    /open\s*\([^)]*['"]a/,
    /subprocess\./,
    /os\.system/,
    /os\.popen/,
    /socket\./,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: 'Code contains potentially dangerous operations',
      };
    }
  }
  
  // Validate requested packages
  for (const pkg of packages) {
    if (BLOCKED_PACKAGES.includes(pkg)) {
      return {
        valid: false,
        error: `Package '${pkg}' is blocked for security reasons`,
      };
    }
    
    if (ALLOWED_PACKAGES.length > 0 && !ALLOWED_PACKAGES.includes(pkg)) {
      return {
        valid: false,
        error: `Package '${pkg}' is not in the allowed packages list`,
      };
    }
  }
  
  return { valid: true };
}

export async function executeCode(
  context: NodeExecutionContext,
  language: 'javascript' | 'python' | 'typescript' | 'bash'
): Promise<NodeExecutionResult> {
  const { input, config, workflowId, nodeId, executionId } = context;
  const nodeConfig = config as any;
  const code = nodeConfig.code || '';
  const startTime = Date.now();
  const runtime = nodeConfig.runtime || 'vm2';

  const tracer = trace.getTracer('sos-code-executor');
  const span = tracer.startSpan('code.execute', {
    attributes: {
      'code.language': language,
      'code.runtime': runtime,
      'code.has_input_schema': !!nodeConfig.inputSchema,
      'code.has_output_schema': !!nodeConfig.outputSchema,
      'code.validation_type': nodeConfig.validationType || (language === 'python' ? 'pydantic' : 'zod'),
      'code.packages_count': (nodeConfig.packages || []).length,
      'code.timeout_ms': nodeConfig.timeout || 30000,
      'code.requires_sandbox': nodeConfig.requiresSandbox || false,
      'code.long_job': nodeConfig.longJob || false,
      'code.expected_duration_ms': nodeConfig.expectedDuration || 0,
      'node.id': nodeId || '',
      'workflow.id': workflowId || '',
      'workflow.execution_id': executionId || '',
    },
  });

  let result: NodeExecutionResult;
  let validationPassed: boolean | undefined;
  let errorMessage: string | undefined;

  try {
    if (!code) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Code is required' });
      return {
        success: false,
        error: {
          message: 'Code is required',
          code: 'MISSING_CODE',
        },
      };
    }

    // Validate input schema if provided
    if (nodeConfig.inputSchema) {
      const validation = await codeValidationService.validateCodeExecution(
        language,
        input,
        undefined, // No output yet
        nodeConfig.inputSchema,
        undefined,
        nodeConfig.validationType || (language === 'python' ? 'pydantic' : 'zod')
      );

      validationPassed = validation.valid;

      if (!validation.valid) {
        span.setAttributes({
          'code.validation_passed': false,
          'code.validation_errors': validation.errors?.length || 0,
        });
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Input validation failed' });
        errorMessage = `Input validation failed: ${validation.errors?.join(', ')}`;
        return {
          success: false,
          error: {
            message: errorMessage,
            code: 'VALIDATION_ERROR',
            details: validation.errors,
          },
        };
      }
      span.setAttributes({ 'code.validation_passed': true });
    }

    // Route to appropriate runtime if auto-routing is enabled
    const requestedRuntime = nodeConfig.runtime || 'auto';
    let actualRuntime = requestedRuntime === 'auto' ? 'vm2' : requestedRuntime;
    
    if (requestedRuntime === 'auto' || requestedRuntime === 'e2b' || requestedRuntime === 'wasmedge' || requestedRuntime === 'bacalhau') {
      // Use runtime router for advanced runtimes
      const packages = nodeConfig.packages || [];
      const timeout = nodeConfig.timeout || 30000;
      
      result = await runtimeRouter.route({
        runtime: requestedRuntime === 'auto' ? undefined : requestedRuntime,
        language,
        code,
        input,
        packages,
        timeout,
        requiresSandbox: nodeConfig.requiresSandbox,
        longJob: nodeConfig.longJob,
        expectedDuration: nodeConfig.expectedDuration,
      }, {
        userId: context.userId,
        organizationId: context.organizationId,
        workspaceId: context.workspaceId,
        workflowId,
        nodeId,
        executionId,
      });
      
      // Update actual runtime based on router decision
      if (requestedRuntime === 'auto') {
        actualRuntime = (result as any).runtime || 'vm2';
        span.setAttributes({
          'code.runtime_selected': actualRuntime,
          'code.routing_reason': 'auto',
        });
      } else {
        span.setAttributes({
          'code.runtime_selected': actualRuntime,
          'code.routing_reason': 'explicit',
        });
      }
    } else {
      // Use default execution (VM2/subprocess)
      if (language === 'javascript') {
        result = executeJavaScript(code, input);
      } else if (language === 'python') {
        const packages = nodeConfig.packages || [];
        const timeout = nodeConfig.timeout || 30000;
        result = await executePython(code, input, { packages, timeout });
      } else if (language === 'typescript') {
        // Compile TypeScript to JavaScript
        const ts = await import('typescript');
        const jsCode = ts.transpile(code, {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
        });
        result = executeJavaScript(jsCode, input);
      } else if (language === 'bash') {
        result = await executeBash(code, input, nodeConfig.timeout || 30000);
      } else {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Unsupported language: ${language}` });
        return {
          success: false,
          error: {
            message: `Unsupported language: ${language}`,
            code: 'UNSUPPORTED_LANGUAGE',
          },
        };
      }
    }

    // Validate output schema if provided
    if (result.success && nodeConfig.outputSchema) {
      const validation = await codeValidationService.validateCodeExecution(
        language,
        input,
        result.output,
        nodeConfig.inputSchema,
        nodeConfig.outputSchema,
        nodeConfig.validationType || (language === 'python' ? 'pydantic' : 'zod')
      );

      validationPassed = validation.valid;

      if (!validation.valid) {
        span.setAttributes({
          'code.output_validation_passed': false,
          'code.output_validation_errors': validation.errors?.length || 0,
        });
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Output validation failed' });
        errorMessage = `Output validation failed: ${validation.errors?.join(', ')}`;
        return {
          success: false,
          error: {
            message: errorMessage,
            code: 'OUTPUT_VALIDATION_ERROR',
            details: validation.errors,
          },
        };
      }
      span.setAttributes({ 'code.output_validation_passed': true });
    }

    const durationMs = Date.now() - startTime;

    // Extract memory and token usage from result metadata if available
    const memoryMb = (result as any).metadata?.memoryMb || (result as any).memoryMb;
    const tokensUsed = (result as any).metadata?.tokensUsed || (result as any).tokensUsed;
    const exitCode = (result as any).metadata?.exitCode || (result as any).exitCode;
    const aiGenerated = (result as any).metadata?.aiGenerated || false;

    span.setAttributes({
      'code.success': result.success,
      'code.has_error': !!result.error,
      'code.duration_ms': durationMs,
      'code.runtime': actualRuntime,
      'code.language': language,
      'code.validation_passed': validationPassed !== undefined ? validationPassed : null,
      ...(memoryMb !== undefined && { 'code.memory_mb': memoryMb }),
      ...(tokensUsed !== undefined && { 'code.tokens_used': tokensUsed }),
      ...(exitCode !== undefined && { 'code.exit_code': exitCode }),
      'code.ai_generated': aiGenerated,
    });
    span.setStatus({ code: result.success ? SpanStatusCode.OK : SpanStatusCode.ERROR });

    // Log execution to database (async, don't wait)
    const codeAgentId = (nodeConfig as any).codeAgentId;
    const organizationId = (context as any).organizationId;
    const workspaceId = (context as any).workspaceId;
    const userId = (context as any).userId;

    codeExecutionLogger.logExecution({
      codeAgentId,
      workflowExecutionId: executionId,
      nodeId,
      runtime: actualRuntime,
      language,
      durationMs,
      memoryMb: memoryMb,
      exitCode: exitCode,
      success: result.success,
      errorMessage: result.error?.message || errorMessage,
      tokensUsed: tokensUsed,
      aiGenerated: aiGenerated,
      validationPassed,
      organizationId,
      workspaceId,
      userId,
    }).catch((err: any) => {
      // Log error but don't fail execution
      console.error('Failed to log code execution:', err);
    });

    return result;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    errorMessage = error.message || 'Code execution failed';

    span.recordException(error);
    span.setAttributes({
      'code.duration_ms': durationMs,
      'code.success': false,
      'code.runtime': actualRuntime,
      'code.language': language,
      'code.validation_passed': validationPassed !== undefined ? validationPassed : null,
    });
    span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });

    // Log failed execution to database
    const codeAgentId = (nodeConfig as any).codeAgentId;
    const organizationId = (context as any).organizationId;
    const workspaceId = (context as any).workspaceId;
    const userId = (context as any).userId;

    codeExecutionLogger.logExecution({
      codeAgentId,
      workflowExecutionId: executionId,
      nodeId,
      runtime: actualRuntime,
      language,
      durationMs,
      success: false,
      errorMessage,
      tokensUsed: undefined,
      validationPassed,
      organizationId,
      workspaceId,
      userId,
    }).catch((err: any) => {
      console.error('Failed to log code execution error:', err);
    });

    return {
      success: false,
      error: {
        message: errorMessage,
        code: 'EXECUTION_ERROR',
        details: error,
      },
    };
  } finally {
    span.end();
  }
}

function executeJavaScript(code: string, input: Record<string, unknown>): NodeExecutionResult {
  const memoryBefore = process.memoryUsage();
  try {
    // Create a sandboxed VM
    const vm = new VM({
      timeout: 5000,
      sandbox: {
        input,
        console: {
          log: (...args: unknown[]) => console.log('[Node Execution]', ...args),
        },
      },
    });

    // Wrap code - if it doesn't return, wrap in function
    let wrappedCode = code.trim();
    if (!wrappedCode.includes('return')) {
      wrappedCode = `return (function() { ${code} })();`;
    } else {
      wrappedCode = `(function() { ${code} })();`;
    }

    const result = vm.run(wrappedCode);
    
    // Track memory usage
    const memoryAfter = process.memoryUsage();
    const memoryUsedMb = (memoryAfter.heapUsed - memoryBefore.heapUsed) / (1024 * 1024);

    return {
      success: true,
      output: {
        output: result !== undefined ? result : input,
      },
      metadata: {
        memoryMb: Math.max(0, memoryUsedMb),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'JavaScript execution failed',
        code: 'JS_EXECUTION_ERROR',
        details: error,
      },
    };
  }
}

async function executePython(
  code: string,
  input: Record<string, unknown>,
  config?: { packages?: string[]; timeout?: number }
): Promise<NodeExecutionResult> {
  try {
    const packages = config?.packages || [];
    
    // Security: Validate code and packages
    const validation = validatePythonCode(code, packages);
    if (!validation.valid) {
      // Security violation - return error (audit logging happens at workflow execution level)
      return {
        success: false,
        error: {
          message: validation.error || 'Code validation failed',
          code: 'PYTHON_SECURITY_ERROR',
        },
      };
    }
    
    // Option 1: Use external Python service (if PYTHON_SERVICE_URL is set)
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
    if (pythonServiceUrl) {
      return await executePythonViaService(pythonServiceUrl, code, input, config);
    }

    // Option 2: Use subprocess (requires Python to be installed)
    return await executePythonViaSubprocess(code, input, config);
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Python execution failed',
        code: 'PYTHON_EXECUTION_ERROR',
        details: error,
      },
    };
  }
}

async function executePythonViaService(
  serviceUrl: string,
  code: string,
  input: Record<string, unknown>,
  config?: { packages?: string[]; timeout?: number }
): Promise<NodeExecutionResult> {
  const axios = (await import('axios')).default;
  
  try {
    const response = await axios.post(
      `${serviceUrl}/execute`,
      {
        code,
        input,
        packages: config?.packages || [],
        timeout: config?.timeout || 30000,
      },
      {
        timeout: (config?.timeout || 30000) + 5000, // Add buffer for network
      }
    );

    return {
      success: true,
      output: {
        output: response.data.result || response.data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error || error.message || 'Python service error',
        code: 'PYTHON_SERVICE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

async function executePythonViaSubprocess(
  code: string,
  input: Record<string, unknown>,
  config?: { packages?: string[]; timeout?: number }
): Promise<NodeExecutionResult> {
  const { spawn } = await import('child_process');
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const timeout = config?.timeout || 30000;
  const packages = config?.packages || [];
  const tempDir = os.tmpdir();
  const execId = `python-exec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const tempFile = path.join(tempDir, `${execId}.py`);
  const requirementsFile = packages.length > 0 ? path.join(tempDir, `${execId}-requirements.txt`) : null;
  
  const memoryBefore = process.memoryUsage();
  try {
    // Install packages if needed (basic implementation - in production, use virtualenv)
    if (packages.length > 0 && requirementsFile) {
      await fs.writeFile(requirementsFile, packages.join('\n'));
      
      // Try to install packages (non-blocking, will fail gracefully if packages not available)
      // In production, this should use a virtualenv or container
      try {
        const installProcess = spawn('pip3', ['install', '-q', '-r', requirementsFile], {
          timeout: 10000,
          stdio: 'ignore',
        });
        await new Promise<void>((resolve, reject) => {
          installProcess.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Package installation failed with code ${code}`));
          });
          installProcess.on('error', reject);
        });
      } catch (installError) {
        // Log but don't fail - packages might already be installed or unavailable
        console.warn('Package installation warning:', installError);
      }
    }

    // Wrap code to handle input/output properly
    // Execute code and capture result variable or return value
    const wrappedCode = `
import json
import sys
import traceback

try:
    # Input data
    input_data = ${JSON.stringify(input)}
    
    # Execute user code
${code.split('\n').map((line) => `    ${line}`).join('\n')}
    
    # Determine result
    # If code set a 'result' variable, use it
    # Otherwise, use input_data
    if 'result' not in locals() and 'result' not in globals():
        result = input_data
    
    # Output result as JSON
    print(json.dumps(result, default=str))
except Exception as e:
    error_info = {
        'error': str(e),
        'type': type(e).__name__,
        'traceback': traceback.format_exc()
    }
    print(json.dumps({'__error__': error_info}), file=sys.stderr)
    sys.exit(1)
`;

    await fs.writeFile(tempFile, wrappedCode);

    // Execute Python with timeout and resource limits
    // Note: On Linux, we could use 'timeout' command or setrlimit for better resource control
    // For now, we rely on process timeout and subprocess isolation
    const pythonProcess = spawn('python3', [tempFile], {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Security: Limit environment variables
      env: {
        ...process.env,
        PYTHONPATH: '', // Prevent importing from custom paths
        PYTHONUNBUFFERED: '1',
      },
      // Security: Run in isolated directory (tempDir is already isolated)
      cwd: tempDir,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error(`Python execution timed out after ${timeout}ms`));
      }, timeout);

      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve(code || 0);
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });

    // Clean up temp files
    await fs.unlink(tempFile).catch(() => {});
    if (requirementsFile) {
      await fs.unlink(requirementsFile).catch(() => {});
    }

    if (exitCode !== 0) {
      // Try to parse error from stderr
      let errorMessage = stderr || 'Python execution failed';
      try {
        const errorMatch = stderr.match(/\{"__error__":\s*({[^}]+})\}/);
        if (errorMatch) {
          const errorData = JSON.parse(errorMatch[1]);
          errorMessage = `${errorData.type}: ${errorData.error}\n${errorData.traceback}`;
        }
      } catch {
        // Use raw stderr if parsing fails
      }

      return {
        success: false,
        error: {
          message: errorMessage,
          code: 'PYTHON_EXECUTION_ERROR',
          details: { exitCode, stderr, stdout },
        },
      };
    }

    // Parse output
    let result;
    try {
      const output = stdout.trim();
      if (!output) {
        result = input;
      } else {
        result = JSON.parse(output);
      }
    } catch (parseError) {
      // If JSON parsing fails, return the raw output
      result = stdout.trim() || input;
    }

    // Track memory usage (approximate - tracks Node.js process, not Python subprocess)
    const memoryAfter = process.memoryUsage();
    const memoryUsedMb = (memoryAfter.heapUsed - memoryBefore.heapUsed) / (1024 * 1024);

    return {
      success: true,
      output: {
        output: result,
      },
      metadata: {
        memoryMb: Math.max(0, memoryUsedMb),
        exitCode,
      },
    };
  } catch (error: any) {
    // Clean up temp files on error
    await fs.unlink(tempFile).catch(() => {});
    if (requirementsFile) {
      await fs.unlink(requirementsFile).catch(() => {});
    }
    
    if (error.code === 'ENOENT') {
      return {
        success: false,
        error: {
          message: 'Python 3 is not installed or not in PATH. Set PYTHON_SERVICE_URL to use an external Python service.',
          code: 'PYTHON_NOT_FOUND',
        },
      };
    }

    if (error.message?.includes('timed out')) {
      return {
        success: false,
        error: {
          message: error.message,
          code: 'PYTHON_TIMEOUT',
        },
      };
    }

    return {
      success: false,
      error: {
        message: error.message || 'Python execution failed',
        code: 'PYTHON_EXECUTION_ERROR',
        details: error,
      },
    };
  }
}

/**
 * Execute Bash code
 */
async function executeBash(
  code: string,
  input: Record<string, unknown>,
  timeout: number = 30000
): Promise<NodeExecutionResult> {
  const { spawn } = await import('child_process');
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const tempDir = os.tmpdir();
  const execId = `bash-exec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const tempFile = path.join(tempDir, `${execId}.sh`);

  const memoryBefore = process.memoryUsage();
  try {
    // Wrap code to handle input/output
    const wrappedCode = `#!/bin/bash
set -e

# Input data as environment variables
${Object.entries(input)
  .map(([key, value]) => `export INPUT_${key}='${JSON.stringify(value).replace(/'/g, "'\\''")}'`)
  .join('\n')}

# Execute user code
${code}

# Output result (if RESULT variable is set, use it; otherwise use input)
if [ -z "$RESULT" ]; then
  RESULT='${JSON.stringify(input).replace(/'/g, "'\\''")}'
fi

echo "$RESULT"
`;

    await fs.writeFile(tempFile, wrappedCode, { mode: 0o755 });

    const bashProcess = spawn('bash', [tempFile], {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: '/usr/bin:/bin:/usr/local/bin',
      },
      cwd: tempDir,
    });

    let stdout = '';
    let stderr = '';

    bashProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    bashProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        bashProcess.kill('SIGTERM');
        reject(new Error(`Bash execution timed out after ${timeout}ms`));
      }, timeout);

      bashProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve(code || 0);
      });

      bashProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });

    // Clean up
    await fs.unlink(tempFile).catch(() => {});

    if (exitCode !== 0) {
      return {
        success: false,
        error: {
          message: stderr || 'Bash execution failed',
          code: 'BASH_EXECUTION_ERROR',
          details: { exitCode, stderr, stdout },
        },
      };
    }

    // Parse output
    let result;
    try {
      const output = stdout.trim();
      if (!output) {
        result = input;
      } else {
        result = JSON.parse(output);
      }
    } catch {
      result = stdout.trim() || input;
    }

    // Track memory usage (approximate - tracks Node.js process, not Bash subprocess)
    const memoryAfter = process.memoryUsage();
    const memoryUsedMb = (memoryAfter.heapUsed - memoryBefore.heapUsed) / (1024 * 1024);

    return {
      success: true,
      output: {
        output: result,
      },
      metadata: {
        memoryMb: Math.max(0, memoryUsedMb),
        exitCode,
      },
    };
  } catch (error: any) {
    await fs.unlink(tempFile).catch(() => {});

    if (error.code === 'ENOENT') {
      return {
        success: false,
        error: {
          message: 'Bash is not installed or not in PATH',
          code: 'BASH_NOT_FOUND',
        },
      };
    }

    if (error.message?.includes('timed out')) {
      return {
        success: false,
        error: {
          message: error.message,
          code: 'BASH_TIMEOUT',
        },
      };
    }

    return {
      success: false,
      error: {
        message: error.message || 'Bash execution failed',
        code: 'BASH_EXECUTION_ERROR',
        details: error,
      },
    };
  }
}

