import { exec } from 'child_process';
import { promisify } from 'util';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { pythonBridgeService } from './pythonBridgeService';

const execAsync = promisify(exec);

/**
 * Stagehand Service
 * 
 * Integration with Stagehand - AI-powered browser automation.
 * Stagehand uses AI to understand web pages and automate tasks based on natural language instructions.
 * 
 * Stagehand is a Python library that can be used via the Python bridge.
 * Alternative: If an npm package exists, we can use that instead.
 */

export interface StagehandConfig {
  goal: string; // Natural language goal (e.g., "Fill out the contact form with my details")
  url: string;
  headless?: boolean;
  timeout?: number;
  maxSteps?: number;
  screenshot?: boolean;
}

export interface StagehandResult {
  success: boolean;
  output?: string;
  steps?: Array<{
    action: string;
    description: string;
    success: boolean;
  }>;
  screenshot?: string; // Base64
  error?: string;
  metadata: {
    executionTime: number;
    stepsCount: number;
  };
}

export class StagehandService {
  /**
   * Generate Python script for Stagehand
   */
  private generatePythonScript(config: StagehandConfig): string {
    const headless = config.headless !== false;
    const timeout = config.timeout || 60000;
    const maxSteps = config.maxSteps || 20;

    return `
import stagehand
import json
import base64
import sys
from io import BytesIO

try:
    # Initialize Stagehand
    agent = stagehand.Stagehand(
        headless=${headless},
        timeout=${timeout / 1000},
        max_steps=${maxSteps}
    )
    
    # Navigate to URL
    agent.navigate("${config.url}")
    
    # Execute goal
    result = agent.execute("${config.goal.replace(/"/g, '\\"')}")
    
    output = {
        "success": True,
        "output": result.output if hasattr(result, 'output') else str(result),
        "steps": [
            {
                "action": step.action if hasattr(step, 'action') else 'unknown',
                "description": step.description if hasattr(step, 'description') else '',
                "success": step.success if hasattr(step, 'success') else True
            }
            for step in (result.steps if hasattr(result, 'steps') else [])
        ] if hasattr(result, 'steps') else [],
    }
    
    ${config.screenshot ? `
    # Take screenshot
    screenshot = agent.screenshot()
    if screenshot:
        screenshot_b64 = base64.b64encode(screenshot).decode('utf-8')
        output["screenshot"] = screenshot_b64
    ` : ''}
    
    print(json.dumps(output))
    
except Exception as e:
    error_result = {
        "success": False,
        "error": str(e),
        "error_type": type(e).__name__,
        "steps": []
    }
    print(json.dumps(error_result))
    sys.exit(1)
`;
  }

  /**
   * Execute Stagehand automation
   */
  async execute(config: StagehandConfig): Promise<StagehandResult> {
    const tracer = trace.getTracer('sos-stagehand');
    const span = tracer.startSpan('stagehand.execute', {
      attributes: {
        'stagehand.url': config.url,
        'stagehand.goal': config.goal,
        'stagehand.headless': config.headless !== false,
      },
    });

    const startTime = Date.now();

    try {
      // Check if stagehand is installed
      const isInstalled = await pythonBridgeService.checkPackageInstalled('stagehand');
      
      if (!isInstalled) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'stagehand not installed',
        });
        span.end();
        
        return {
          success: false,
          error: 'stagehand is not installed. Please install it: pip install stagehand',
          metadata: {
            executionTime: Date.now() - startTime,
            stepsCount: 0,
          },
        };
      }

      // Generate Python script
      const pythonScript = this.generatePythonScript(config);

      span.setAttributes({
        'stagehand.script_length': pythonScript.length,
      });

      // Execute Python script
      const pythonResult = await pythonBridgeService.execute({
        script: pythonScript,
        timeout: (config.timeout || 60000) + 30000, // Add buffer
      });

      const executionTime = Date.now() - startTime;

      if (!pythonResult.success) {
        span.setAttributes({
          'stagehand.success': false,
          'stagehand.error': pythonResult.stderr,
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: pythonResult.stderr,
        });
        span.end();

        return {
          success: false,
          error: pythonResult.stderr || 'Python execution failed',
          metadata: {
            executionTime,
            stepsCount: 0,
          },
        };
      }

      // Parse JSON result
      try {
        const result = JSON.parse(pythonResult.stdout);

        span.setAttributes({
          'stagehand.success': result.success || false,
          'stagehand.steps_count': len(result.get('steps', [])) || 0,
        });

        if (result.success) {
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();

          return {
            success: true,
            output: result.output,
            steps: result.steps || [],
            screenshot: result.screenshot,
            metadata: {
              executionTime,
              stepsCount: len(result.get('steps', [])) || 0,
            },
          };
        } else {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: result.error || 'Unknown error',
          });
          span.end();

          return {
            success: false,
            error: result.error || 'Unknown error',
            metadata: {
              executionTime,
              stepsCount: 0,
            },
          };
        }
      } catch (parseError: any) {
        span.recordException(parseError);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Failed to parse result',
        });
        span.end();

        return {
          success: false,
          error: `Failed to parse result: ${parseError.message}. Python output: ${pythonResult.stdout}`,
          metadata: {
            executionTime,
            stepsCount: 0,
          },
        };
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      span.recordException(error);
      span.setAttributes({
        'stagehand.success': false,
        'stagehand.error': error.message,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();

      return {
        success: false,
        error: error.message || 'Unknown error',
        metadata: {
          executionTime,
          stepsCount: 0,
        },
      };
    }
  }
}

export const stagehandService = new StagehandService();

