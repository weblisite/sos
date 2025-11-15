import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { browserAutomationService, BrowserActionConfig } from '../browserAutomationService';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { posthogService } from '../posthogService';

/**
 * Browser Automation Node Executor
 * 
 * Executes browser automation operations in workflow nodes.
 * Supports navigate, click, fill, extract, screenshot, wait, and evaluate actions.
 */

export async function executeBrowserAutomation(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config, nodeId, executionId, userId, organizationId, workspaceId } = context;
  const nodeConfig = config as any;

  const tracer = trace.getTracer('sos-node-executor');
  const span = tracer.startSpan('node.execute.browser_automation', {
    attributes: {
      'node.id': nodeId,
      'node.type': 'action.browser_automation',
      'workflow.execution_id': executionId || '',
      'user.id': userId || '',
      'organization.id': organizationId || '',
      'workspace.id': workspaceId || '',
    },
  });

  const startTime = Date.now();

  try {
    // Get action from config or input
    const action = (nodeConfig.action as string) || (input.action as string) || 'navigate';
    
    if (!['navigate', 'click', 'fill', 'extract', 'screenshot', 'wait', 'evaluate'].includes(action)) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Invalid action: ${action}`,
      });
      span.end();
      
      return {
        success: false,
        error: {
          message: `Invalid action: ${action}. Must be one of: navigate, click, fill, extract, screenshot, wait, evaluate`,
          code: 'INVALID_ACTION',
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Build browser action config
    const actionConfig: BrowserActionConfig = {
      action: action as any,
      url: (nodeConfig.url as string) || (input.url as string),
      selector: (nodeConfig.selector as string) || (input.selector as string),
      text: (nodeConfig.text as string) || (input.text as string),
      value: (nodeConfig.value as string) || (input.value as string),
      waitForSelector: (nodeConfig.waitForSelector as string) || (input.waitForSelector as string),
      waitTimeout: (nodeConfig.waitTimeout as number) || (input.waitTimeout as number) || 30000,
      screenshot: nodeConfig.screenshot === true || input.screenshot === true,
      extractSelectors: (nodeConfig.extractSelectors as Record<string, string>) || (input.extractSelectors as Record<string, string>),
      evaluateScript: (nodeConfig.evaluateScript as string) || (input.evaluateScript as string),
      explicitEngine: (nodeConfig.explicitEngine as 'playwright' | 'puppeteer') || (input.explicitEngine as 'playwright' | 'puppeteer'),
      htmlType: (nodeConfig.htmlType as 'static' | 'dynamic') || (input.htmlType as 'static' | 'dynamic'),
      requiresInteraction: nodeConfig.requiresInteraction === true || input.requiresInteraction === true,
      useProxy: nodeConfig.useProxy === true || input.useProxy === true,
      context: {
        organizationId: organizationId || undefined,
        workspaceId: workspaceId || undefined,
        userId: userId || undefined,
      },
    };

    span.setAttributes({
      'browser.action': action,
      'browser.url': actionConfig.url || '',
      'browser.engine': actionConfig.explicitEngine || 'auto',
    });

    // Execute browser action
    const result = await browserAutomationService.executeAction(actionConfig);

    const executionTime = Date.now() - startTime;

    if (result.success) {
      span.setAttributes({
        'browser.success': true,
        'browser.latency_ms': result.metadata.latency,
        'browser.engine_used': result.metadata.engine,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      // Track in PostHog
      if (userId && organizationId) {
        const spanContext = span.spanContext();
        posthogService.trackToolUsed({
          userId,
          organizationId,
          workspaceId: workspaceId || undefined,
          toolId: nodeId,
          toolType: 'browser_automation',
          status: 'success',
          latencyMs: executionTime,
          executionId: executionId || undefined,
          traceId: spanContext.traceId,
        });
      }

      span.end();

      return {
        success: true,
        output: {
          action: result.action,
          data: result.data,
          screenshot: result.screenshot,
          html: result.html,
          metadata: result.metadata,
        },
        metadata: {
          executionTime,
          latency: result.metadata.latency,
          engine: result.metadata.engine,
        },
      };
    } else {
      span.setAttributes({
        'browser.success': false,
        'browser.error': result.error || 'Unknown error',
        'browser.latency_ms': result.metadata.latency,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: result.error || 'Browser automation failed',
      });

      // Track failure in PostHog
      if (userId && organizationId) {
        const spanContext = span.spanContext();
        posthogService.trackToolUsed({
          userId,
          organizationId,
          workspaceId: workspaceId || undefined,
          toolId: nodeId,
          toolType: 'browser_automation',
          status: 'error',
          latencyMs: executionTime,
          executionId: executionId || undefined,
          traceId: spanContext.traceId,
        });
      }

      span.end();

      return {
        success: false,
        error: {
          message: result.error || 'Browser automation failed',
          code: 'BROWSER_AUTOMATION_ERROR',
          details: {
            action: result.action,
            metadata: result.metadata,
          },
        },
        metadata: {
          executionTime,
        },
      };
    }
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    span.recordException(error);
    span.setAttributes({
      'browser.success': false,
      'browser.error': error.message,
      'node.execution_time_ms': executionTime,
    });
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });

    // Track error in PostHog
    if (userId && organizationId) {
      const spanContext = span.spanContext();
      posthogService.trackToolUsed({
        userId,
        organizationId,
        workspaceId: workspaceId || undefined,
        toolId: nodeId,
        toolType: 'browser_automation',
        status: 'error',
        latencyMs: executionTime,
        executionId: executionId || undefined,
        traceId: spanContext.traceId,
      });
    }

    span.end();

    return {
      success: false,
      error: {
        message: error.message || 'Unknown error during browser automation',
        code: error.code || 'BROWSER_AUTOMATION_EXECUTION_ERROR',
        details: error,
      },
      metadata: {
        executionTime,
      },
    };
  }
}

