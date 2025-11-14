import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { agentService, AgentConfig, AgentResponse } from '../agentService';
import { agentRouter, RoutingHeuristics } from '../agentRouter';
import { guardrailsService } from '../guardrailsService';
import { selfHealingService } from '../selfHealingService';
import { contextCacheService } from '../contextCacheService';
import { observabilityService } from '../observabilityService';
import { posthogService } from '../posthogService';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../config/database';
import { agentTraceHistory } from '../../../drizzle/schema';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Agent Node Executor
 * 
 * Executes autonomous agents using LangChain's AgentExecutor
 * Supports:
 * - ReAct agents
 * - Plan-and-Execute agents
 * - Zero-shot ReAct agents
 * - Memory persistence
 * - Tool integration
 */

/**
 * Write agent trace history to database
 */
async function writeAgentTraceHistory(data: {
  agentId: string;
  flowId: string;
  traceId: string;
  inputContext: Record<string, unknown>;
  executionNodes: unknown[];
  outputSummary: Record<string, unknown>;
  error?: string;
  userId?: string;
}): Promise<void> {
  try {
    await db.insert(agentTraceHistory).values({
      id: createId(),
      agentId: data.agentId,
      flowId: data.flowId,
      traceId: data.traceId,
      inputContext: data.inputContext as any,
      executionNodes: data.executionNodes as any,
      outputSummary: data.outputSummary as any,
      error: data.error || null,
      timestamp: new Date(),
    });
  } catch (err: any) {
    console.error('[Agent Executor] Failed to write trace history:', err);
    // Don't throw - observability should not break execution
  }
}

export async function executeAgent(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config, workflowId, nodeId } = context;
  const nodeConfig = config as any;

  // Get query from input
  const query = (input.query as string) || (input.input as string) || (input.message as string) || '';
  
  if (!query) {
    return {
      success: false,
      error: {
        message: 'Query is required for agent execution',
        code: 'MISSING_QUERY',
      },
    };
  }

  // Guardrails: Validate input
  const inputSchema = guardrailsService.createInputSchema();
  const inputValidation = guardrailsService.validateInput({ query, context: input }, inputSchema);
  if (!inputValidation.valid) {
    return {
      success: false,
      error: {
        message: `Input validation failed: ${inputValidation.errors?.join(', ')}`,
        code: 'VALIDATION_ERROR',
      },
    };
  }

  // Guardrails: Check content safety
  const safetyCheck = guardrailsService.checkContentSafety(query);
  if (!safetyCheck.safe) {
    const criticalViolations = safetyCheck.violations?.filter(v => v.severity === 'critical');
    if (criticalViolations && criticalViolations.length > 0) {
      return {
        success: false,
        error: {
          message: 'Content safety check failed: blocked content detected',
          code: 'CONTENT_SAFETY_ERROR',
          details: safetyCheck.violations,
        },
      };
    }
  }

  // Guardrails: Check for abuse
  const abuseCheck = guardrailsService.checkAbuse(query);
  if (abuseCheck.isAbuse && abuseCheck.action === 'block') {
    // Track prompt blocking in PostHog
    if (context.userId && context.organizationId) {
      posthogService.trackPromptBlocked({
        userId: context.userId,
        organizationId: context.organizationId,
        workspaceId: (context as any).workspaceId || undefined,
        matchScore: abuseCheck.confidence,
        source: 'abuse_detection',
        promptPreview: query.substring(0, 100),
        reason: abuseCheck.abuseType || 'Abuse pattern detected',
      });
    }

    return {
      success: false,
      error: {
        message: 'Abuse detection: request blocked',
        code: 'ABUSE_DETECTED',
        details: abuseCheck,
      },
    };
  }

  // Guardrails: Check prompt similarity (if enabled)
  try {
    const enableSimilarityCheck = await featureFlagService.isEnabled(
      'enable_prompt_similarity_check',
      context.userId,
      (context as any).workspaceId
    );

    if (enableSimilarityCheck) {
      // Get known prompts from configuration or database
      const knownPrompts = (nodeConfig.knownPrompts as string[]) || [];
      const similarityThreshold = (nodeConfig.similarityThreshold as number) || 0.85;

      if (knownPrompts.length > 0) {
        const similarityResult = await guardrailsService.checkPromptSimilarity(
          query,
          knownPrompts,
          context.userId || undefined,
          (context as any).organizationId || undefined,
          (context as any).workspaceId || undefined,
          similarityThreshold,
          'cosine',
          context.executionId || undefined,
          context.nodeId || undefined,
          undefined // traceId can be added later if needed
        );

        if (similarityResult.similar) {
          // Track prompt blocking in PostHog
          if (context.userId && context.organizationId) {
            posthogService.trackPromptBlocked({
              userId: context.userId,
              organizationId: context.organizationId,
              workspaceId: (context as any).workspaceId || undefined,
              matchScore: similarityResult.similarityScore,
              source: 'prompt_similarity',
              promptPreview: query.substring(0, 100),
              reason: `Similar to known prompt (${(similarityResult.similarityScore * 100).toFixed(1)}% similarity)`,
            });
          }

          return {
            success: false,
            error: {
              message: `Prompt similarity check failed: prompt is too similar to known prompts (${(similarityResult.similarityScore * 100).toFixed(1)}% similarity)`,
              code: 'PROMPT_SIMILARITY_ERROR',
              details: {
                similarityScore: similarityResult.similarityScore,
                matchedPrompts: similarityResult.matchedPrompts,
              },
            },
          };
        }
      }
    }
  } catch (error: any) {
    console.warn('[Agent Executor] Prompt similarity check failed:', error);
    // Continue execution if similarity check fails
  }

  // Get routing heuristics (if provided) or use defaults
  const heuristics: RoutingHeuristics = (nodeConfig.routingHeuristics as RoutingHeuristics) || {
    agent_type: (nodeConfig.agentType as string) || 'simple',
    recursive_planning: nodeConfig.recursivePlanning as boolean || false,
    agent_roles: nodeConfig.agentRoles as number || 1,
    agent_self_fix: nodeConfig.agentSelfFix as boolean || false,
    tools_required: true,
  };

  // Use routing if enabled, otherwise use direct agent config
  const useRouting = (nodeConfig.useRouting as boolean) ?? true;
  
  const agentType = (nodeConfig.agentType as AgentConfig['type']) || 'react';
  const provider = (nodeConfig.provider as AgentConfig['provider']) || 'openai';
  const model = (nodeConfig.model as string) || (provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229');
  const temperature = (nodeConfig.temperature as number) ?? 0.7;
  const maxIterations = (nodeConfig.maxIterations as number) ?? 15;
  const maxExecutionTime = (nodeConfig.maxExecutionTime as number) ?? 60000;
  const returnIntermediateSteps = (nodeConfig.returnIntermediateSteps as boolean) ?? true;
  const systemPrompt = (nodeConfig.systemPrompt as string) || undefined;
  const tools = (nodeConfig.tools as string[]) || [];
  const memoryType = (nodeConfig.memoryType as AgentConfig['memoryType']) || 'buffer';
  const memoryMaxTokenLimit = (nodeConfig.memoryMaxTokenLimit as number) ?? 2000;
  const stream = (nodeConfig.stream as boolean) ?? false;

  let observabilitySpan: any = null;
  const startTime = Date.now();

  // Create OpenTelemetry span for agent execution
  const tracer = trace.getTracer('sos-agent-executor');
  const otelSpan = tracer.startSpan('agent.execute', {
    attributes: {
      'agent.id': `${workflowId}-${nodeId}`,
      'agent.framework': (nodeConfig.agentType as string) || 'auto',
      'agent.type': agentType,
      'agent.provider': provider,
      'agent.model': model,
      'node.id': nodeId,
      'workflow.id': workflowId,
      'workflow.execution_id': context.executionId,
      'user.id': context.userId || '',
      'organization.id': context.organizationId || '',
    },
  });

  let traceId: string | undefined;
  try {
    const spanContext = otelSpan.spanContext();
    traceId = spanContext.traceId;

    let result: AgentResponse;
    const executionId = context.executionId || createId();

    // Start observability span (legacy)
    observabilitySpan = observabilityService.startAgentSpan({
      agentId: `${workflowId}-${nodeId}`,
      framework: (nodeConfig.agentType as string) || 'auto',
      query,
      executionId,
      organizationId: context.organizationId,
      userId: context.userId,
    });

    // Store initial context
    await contextCacheService.storeContext(
      `${workflowId}-${nodeId}`,
      workflowId,
      executionId,
      input as Record<string, unknown>,
      { nodeId, workflowId }
    );

    // Create initial snapshot
    await contextCacheService.createSnapshot(
      `${workflowId}-${nodeId}`,
      workflowId,
      executionId,
      input as Record<string, unknown>,
      0
    );

    // Use routing if enabled
    if (useRouting) {
      // Agent configuration (will be merged with framework recommendations)
      const agentConfig: Partial<AgentConfig> = {
        provider,
        model,
        temperature,
        maxIterations,
        maxExecutionTime,
        returnIntermediateSteps,
        verbose: false,
        systemPrompt,
        tools,
        memoryType,
        memoryMaxTokenLimit,
      };

      // Execute with routing (with retry/fallback)
      const maxRetries = (nodeConfig.maxRetries as number) ?? 2;
      result = await agentRouter.executeWithRouting(
        query,
        heuristics,
        agentConfig,
        input as Record<string, unknown>,
        maxRetries
      );
    } else {
      // Direct execution (legacy mode)
      const agentId = `agent_${workflowId}_${nodeId}`;

      // Agent configuration
      const agentConfig: AgentConfig = {
        type: agentType,
        provider,
        model,
        temperature,
        maxIterations,
        maxExecutionTime,
        returnIntermediateSteps,
        verbose: false,
        systemPrompt,
        tools,
        memoryType,
        memoryMaxTokenLimit,
      };

      // Create agent if it doesn't exist
      try {
        await agentService.createAgent(agentId, agentConfig);
        
        // Track agent creation in PostHog
        if (context.userId && context.organizationId) {
          posthogService.trackAgentCreated({
            userId: context.userId,
            organizationId: context.organizationId,
            workspaceId: (context as any).workspaceId || undefined,
            agentId,
            agentType: agentType,
            memoryBackend: memoryType,
            framework: agentType,
          });
        }
      } catch (error: any) {
        // Agent might already exist, try to use it
        if (!error.message?.includes('already exists')) {
          // If it's a different error, rethrow
          throw error;
        }
      }

      // Execute agent
      if (stream) {
      // For streaming, we'll return the first chunk
      // In a real implementation, this would use WebSockets
      const chunks: any[] = [];
      for await (const chunk of await agentService.streamAgent(agentId, query, input as Record<string, unknown>)) {
        chunks.push(chunk);
        // Return first chunk for now (streaming would need WebSocket integration)
        if (chunks.length === 1) {
          return {
            success: true,
            output: {
              output: chunk.output || '',
              intermediateSteps: chunk.intermediateSteps,
              executionTime: chunk.executionTime,
              streaming: true,
            },
            metadata: {
              executionTime: chunk.executionTime,
            },
          };
        }
      }

      // If we got here, return the last chunk
      const lastChunk = chunks[chunks.length - 1];
      return {
        success: true,
        output: {
          output: lastChunk.output || '',
          intermediateSteps: lastChunk.intermediateSteps,
          executionTime: lastChunk.executionTime,
          streaming: true,
        },
        metadata: {
          executionTime: lastChunk.executionTime,
        },
      };
      } else {
        // Execute synchronously
        result = await agentService.executeAgent(agentId, query, input as Record<string, unknown>);
      }
    }

    // Guardrails: Validate output
    const outputSchema = guardrailsService.createOutputSchema();
    const outputValidation = guardrailsService.validateOutput(result, outputSchema);
    if (!outputValidation.valid) {
      console.warn('Output validation failed:', outputValidation.errors);
      // Don't fail, but log warning
    }

    // Guardrails: Check output safety
    const outputSafetyCheck = guardrailsService.checkContentSafety(result.output);
    if (!outputSafetyCheck.safe && outputSafetyCheck.violations?.some(v => v.severity === 'critical')) {
      // Self-healing: Try to repair
      const agentId = `${workflowId}-${nodeId}`;
      const failure = selfHealingService.detectFailure(agentId, result, null);
      
      if (failure) {
        selfHealingService.recordFailure(agentId, failure);
        const repairPlan = await selfHealingService.generateRepairPlan(
          agentId,
          failure,
          query,
          input as Record<string, unknown>
        );
        
        // Queue repair for async execution
        await selfHealingService.queueRepair(
          repairPlan.planId,
          query,
          { provider, model, temperature },
          input as Record<string, unknown>
        );
      }

      return {
        success: false,
        error: {
          message: 'Output content safety check failed',
          code: 'OUTPUT_SAFETY_ERROR',
          details: outputSafetyCheck.violations,
        },
      };
    }

    // Store successful context
    await contextCacheService.storeContext(
      `${workflowId}-${nodeId}`,
      workflowId,
      executionId,
      { ...input, output: result.output } as Record<string, unknown>,
      { nodeId, workflowId, success: true }
    );

    // Record metrics
    const executionTime = Date.now() - startTime;
    const finalTraceId = traceId || `${executionId}-${Date.now()}`;
    
    // Update OpenTelemetry span
    otelSpan.setAttributes({
      'agent.status': 'success',
      'agent.latency_ms': executionTime,
      'agent.tokens_used': result.tokensUsed || 0,
      'agent.cost': result.cost || 0,
      'agent.iterations': result.intermediateSteps?.length || 0,
    });
    otelSpan.setStatus({ code: SpanStatusCode.OK });
    otelSpan.end();
    
    await observabilityService.recordExecution(
      (nodeConfig.agentType as string) || 'auto',
      executionTime,
      true,
      context.userId,
      (context as any).workspaceId,
      finalTraceId,
      result.tokensUsed,
      result.cost
    );

    // Write to agent_trace_history
    await writeAgentTraceHistory({
      agentId: `${workflowId}-${nodeId}`,
      flowId: executionId,
      traceId: finalTraceId,
      inputContext: input,
      executionNodes: result.intermediateSteps || [],
      outputSummary: { output: result.output, success: true },
      userId: context.userId,
    });

    // Track in PostHog
    if (context.userId && context.organizationId) {
      posthogService.trackAgentExecution({
        userId: context.userId,
        organizationId: context.organizationId,
        executionId,
        framework: (nodeConfig.agentType as string) || 'auto',
        query,
        success: true,
        executionTime,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
      });
    }

    observabilityService.setStatus(observabilitySpan, 'ok');
    observabilityService.endSpan(observabilitySpan);

    // Return result
    if (useRouting) {

      return {
        success: true,
        output: {
          output: result.output,
          intermediateSteps: result.intermediateSteps,
          memory: result.memory,
          executionTime: result.executionTime,
        },
        metadata: {
          executionTime: result.executionTime,
          tokensUsed: result.tokensUsed,
          cost: result.cost,
        },
      };
    } else {
      // Legacy mode result (already handled above)
      return {
        success: true,
        output: {
          output: result.output,
          intermediateSteps: result.intermediateSteps,
          memory: result.memory,
          executionTime: result.executionTime,
        },
        metadata: {
          executionTime: result.executionTime,
          tokensUsed: result.tokensUsed,
          cost: result.cost,
        },
      };
    }
  } catch (error: any) {
    // Record error metrics
    const executionTime = Date.now() - startTime;
    const finalTraceId = traceId || `${executionId}-${Date.now()}`;
    
    // Update OpenTelemetry span with error
    otelSpan.setAttributes({
      'agent.status': 'error',
      'agent.latency_ms': executionTime,
      'agent.error': error.message,
      'agent.error_code': error.code || 'AGENT_ERROR',
    });
    otelSpan.recordException(error);
    otelSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    otelSpan.end();
    
    await observabilityService.recordExecution(
      (nodeConfig.agentType as string) || 'auto',
      executionTime,
      false,
      context.userId,
      (context as any).workspaceId,
      finalTraceId,
      undefined,
      undefined,
      error.message
    );

    // Write to agent_trace_history
    await writeAgentTraceHistory({
      agentId: `${workflowId}-${nodeId}`,
      flowId: executionId,
      traceId: finalTraceId,
      inputContext: input,
      executionNodes: [],
      outputSummary: { error: error.message },
      error: error.message,
      userId: context.userId,
    });

    // Track error in PostHog
    if (context.userId && context.organizationId) {
      posthogService.trackAgentError(
        context.userId,
        context.organizationId,
        executionId,
        (nodeConfig.agentType as string) || 'auto',
        error.message,
        error.code || 'unknown'
      );

      posthogService.trackAgentExecution({
        userId: context.userId,
        organizationId: context.organizationId,
        executionId,
        framework: (nodeConfig.agentType as string) || 'auto',
        query,
        success: false,
        executionTime,
        error: error.message,
      });
    }

    observabilityService.setStatus(span, 'error', error.message);
    observabilityService.endSpan(span);

    // Self-healing: Detect failure and generate repair plan
    const agentId = `${workflowId}-${nodeId}`;
    const executionId = context.executionId || createId();
    const failure = selfHealingService.detectFailure(agentId, null, error);
    
    if (failure) {
      selfHealingService.recordFailure(agentId, failure);
      
      // Generate and queue repair plan
      try {
        const repairPlan = await selfHealingService.generateRepairPlan(
          agentId,
          failure,
          query,
          input as Record<string, unknown>
        );
        
        // Queue repair for async execution
        const repairJobId = await selfHealingService.queueRepair(
          repairPlan.planId,
          query,
          { provider, model, temperature, maxIterations },
          input as Record<string, unknown>
        );

        // Try to rollback to last snapshot if available
        const snapshots = contextCacheService.getSnapshots(executionId);
        if (snapshots.length > 0) {
          const lastSnapshot = snapshots[snapshots.length - 1];
          // Rollback context could be used for retry
        }
      } catch (repairError) {
        console.error('Error generating repair plan:', repairError);
      }
    }

    // Enhanced error handling with retry information
    const errorMessage = error.message || 'Agent execution failed';
    const isRetryError = errorMessage.includes('attempts');
    
    return {
      success: false,
      error: {
        message: errorMessage,
        code: isRetryError ? 'AGENT_RETRY_EXHAUSTED' : 'AGENT_ERROR',
        details: {
          ...error,
          retryable: !isRetryError, // Can retry if not already exhausted
          failure: failure || undefined,
        },
      },
    };
  }
}

/**
 * Execute agent with memory management
 */
export async function executeAgentWithMemory(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  // Same as executeAgent, but ensures memory is used
  const nodeConfig = context.config as any;
  
  // Force memory usage
  if (!nodeConfig.memoryType || nodeConfig.memoryType === 'none') {
    nodeConfig.memoryType = 'buffer';
  }

  return executeAgent(context);
}

