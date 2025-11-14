import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { aiService } from '../aiService';
import { db } from '../../config/database';
import { modelCostLogs, organizations } from '../../../drizzle/schema';
import { createId } from '@paralleldrive/cuid2';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { featureFlagService } from '../featureFlagService';
import { costCalculationService } from '../costCalculationService';
import { guardrailsService } from '../guardrailsService';
import { langfuseService } from '../langfuseService';
import { archGWService } from '../archGWService';
import { eq } from 'drizzle-orm';

export async function executeLLM(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const prompt = (input.prompt as string) || nodeConfig.prompt || '';
  if (!prompt) {
    return {
      success: false,
      error: {
        message: 'Prompt is required for LLM node',
        code: 'MISSING_PROMPT',
      },
    };
  }

  const startTime = Date.now();
  let modelName = nodeConfig.model || 'gpt-3.5-turbo';
  let provider = (nodeConfig.provider as 'openai' | 'anthropic' | 'google') || 'openai';

  // Create OpenTelemetry span for LLM execution
  const tracer = trace.getTracer('sos-llm-executor');
  const span = tracer.startSpan('llm.generate', {
    attributes: {
      'llm.provider': provider,
      'llm.model': modelName,
      'node.id': context.nodeId,
      'workflow.id': context.workflowId,
      'workflow.execution_id': context.executionId,
    },
  });

  let traceId: string | undefined;
  let routingDecision: any = null;
  
  try {
    const spanContext = span.spanContext();
    traceId = spanContext.traceId;

    // ArchGW: Unified routing decision (if enabled)
    try {
      const enableArchGW = await featureFlagService.isEnabled(
        'enable_archgw_routing',
        context.userId,
        (context as any).workspaceId
      );

      if (enableArchGW) {
        // Get compliance requirements from organization settings or node config
        let complianceRequirements: string[] = [];
        const organizationId = (context as any).organizationId;
        
        if (organizationId) {
          try {
            const [org] = await db
              .select({ settings: organizations.settings })
              .from(organizations)
              .where(eq(organizations.id, organizationId))
              .limit(1);
            
            if (org?.settings && typeof org.settings === 'object') {
              const settings = org.settings as any;
              complianceRequirements = settings.complianceRequirements || [];
            }
          } catch (error: any) {
            console.warn('[LLM Executor] Failed to fetch organization settings:', error);
          }
        }

        // Merge with node config compliance requirements
        if (nodeConfig.complianceRequirements) {
          complianceRequirements = [
            ...complianceRequirements,
            ...(Array.isArray(nodeConfig.complianceRequirements) 
              ? nodeConfig.complianceRequirements 
              : [nodeConfig.complianceRequirements])
          ];
        }

        // Get routing decision from ArchGW
        routingDecision = await archGWService.routePrompt({
          userId: context.userId || undefined,
          organizationId: (context as any).organizationId || undefined,
          workspaceId: (context as any).workspaceId || undefined,
          prompt,
          requestedProvider: provider,
          requestedModel: modelName,
          userRegion: nodeConfig.userRegion || (context as any).userRegion,
          preferredRegion: nodeConfig.preferredRegion || (context as any).preferredRegion,
          dataResidency: nodeConfig.dataResidency || (context as any).dataResidency,
          complianceRequirements: complianceRequirements.length > 0 ? complianceRequirements : undefined,
          maxCost: nodeConfig.maxCost,
          enableCostTiering: nodeConfig.enableCostTiering,
          enableRegionRouting: nodeConfig.enableRegionRouting,
          enablePromptLengthRouting: nodeConfig.enablePromptLengthRouting,
          enforceCompliance: nodeConfig.enforceCompliance !== false,
          allowModelDowngrade: nodeConfig.allowModelDowngrade !== false,
          strictCompliance: nodeConfig.strictCompliance === true,
        });

        // Apply routing decision
        if (routingDecision) {
          // Update model and provider based on routing decision
          if (routingDecision.model && routingDecision.model !== modelName) {
            const originalModel = modelName;
            modelName = routingDecision.model;
            span.setAttributes({
              'archgw.original_model': originalModel,
              'archgw.final_model': modelName,
              'archgw.model_changed': true,
            });
          }

          if (routingDecision.provider && routingDecision.provider !== provider) {
            provider = routingDecision.provider;
            span.setAttributes({
              'archgw.provider_changed': true,
              'archgw.final_provider': provider,
            });
          }

          // Add routing decision attributes
          span.setAttributes({
            'archgw.region': routingDecision.region || 'none',
            'archgw.reason': routingDecision.reason || 'none',
            'archgw.factors': routingDecision.factors?.join(',') || 'none',
            'archgw.requires_compliance': routingDecision.requiresCompliance || false,
            'archgw.data_residency': routingDecision.dataResidency || 'none',
            'archgw.cost_tier': routingDecision.costTier || 'none',
            'archgw.estimated_cost': routingDecision.estimatedCost || 0,
          });

          if (routingDecision.endpoint) {
            span.setAttributes({
              'archgw.endpoint': routingDecision.endpoint,
            });
          }

          // Add warnings and errors
          if (routingDecision.warnings && routingDecision.warnings.length > 0) {
            span.setAttributes({
              'archgw.warnings': routingDecision.warnings.join('; '),
            });
          }

          if (routingDecision.errors && routingDecision.errors.length > 0) {
            span.setAttributes({
              'archgw.errors': routingDecision.errors.join('; '),
            });
            // If strict compliance and errors exist, fail early
            if (nodeConfig.strictCompliance) {
              span.setStatus({ 
                code: SpanStatusCode.ERROR, 
                message: `ArchGW routing failed: ${routingDecision.errors.join(', ')}` 
              });
              span.end();
              return {
                success: false,
                error: {
                  message: `Routing failed: ${routingDecision.errors.join(', ')}`,
                  code: 'ARCHGW_ROUTING_ERROR',
                  details: routingDecision,
                },
              };
            }
          }

          console.log(`[LLM Executor] ArchGW routing: ${routingDecision.reason}`);
        }
      }
    } catch (error: any) {
      console.warn('[LLM Executor] ArchGW routing failed:', error);
      // Continue with default routing if ArchGW fails
    }

    // Guardrails: Check prompt length (skip if ArchGW already handled it)
    try {
      const enableLengthCheck = await featureFlagService.isEnabled(
        'enable_prompt_length_check',
        context.userId,
        (context as any).workspaceId
      );

      // Skip individual checks if ArchGW already handled routing
      const skipIndividualChecks = routingDecision && routingDecision.factors?.includes('prompt_length');

      if (enableLengthCheck && !skipIndividualChecks) {
        const lengthCheck = guardrailsService.checkPromptLength(prompt, {
          minLength: nodeConfig.minPromptLength,
          maxLength: nodeConfig.maxPromptLength,
          minTokens: nodeConfig.minTokens,
          maxTokens: nodeConfig.maxTokens || 128000,
          warnThreshold: nodeConfig.lengthWarnThreshold || 0.8,
          model: modelName,
          provider,
        });

        span.setAttributes({
          'guardrails.prompt_length': lengthCheck.length,
          'guardrails.token_estimate': lengthCheck.tokenEstimate || 0,
          'guardrails.length_check': lengthCheck.valid ? 'passed' : 'failed',
        });

        if (!lengthCheck.valid) {
          span.setAttributes({
            'guardrails.length_errors': lengthCheck.errors?.join('; ') || '',
          });
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Prompt length check failed' });
          span.end();

          return {
            success: false,
            error: {
              message: `Prompt length check failed: ${lengthCheck.errors?.join(', ')}`,
              code: 'PROMPT_LENGTH_ERROR',
              details: {
                length: lengthCheck.length,
                tokenEstimate: lengthCheck.tokenEstimate,
                errors: lengthCheck.errors,
                warnings: lengthCheck.warnings,
                recommendedModel: lengthCheck.recommendedModel,
              },
            },
          };
        }

        if (lengthCheck.warnings && lengthCheck.warnings.length > 0) {
          span.setAttributes({
            'guardrails.length_warnings': lengthCheck.warnings.join('; '),
          });
        }

        // Update model if recommendation is different and auto-routing is enabled
        if (lengthCheck.recommendedModel && 
            lengthCheck.recommendedModel !== modelName &&
            nodeConfig.autoRouteByLength !== false) {
          span.setAttributes({
            'guardrails.model_recommendation': lengthCheck.recommendedModel,
            'guardrails.original_model': modelName,
          });
          // Note: In a full implementation, we would update the model here
          // For now, we just log the recommendation
        }
      }
    } catch (error: any) {
      console.warn('[LLM Executor] Prompt length check failed:', error);
      // Continue execution if length check fails
    }

    // Guardrails: Apply cost tiering based on plan (skip if ArchGW already handled it)
    try {
      const enableCostTiering = await featureFlagService.isEnabled(
        'enable_cost_tiering',
        context.userId,
        (context as any).workspaceId
      );

      // Skip individual checks if ArchGW already handled routing
      const skipIndividualChecks = routingDecision && routingDecision.factors?.includes('cost_tiering');

      if (enableCostTiering && !skipIndividualChecks) {
        // Get organization plan
        let organizationPlan: 'free' | 'pro' | 'team' | 'enterprise' = 'free';
        const organizationId = (context as any).organizationId;
        
        if (organizationId) {
          try {
            const [org] = await db
              .select({ plan: organizations.plan })
              .from(organizations)
              .where(eq(organizations.id, organizationId))
              .limit(1);
            
            if (org) {
              organizationPlan = org.plan as 'free' | 'pro' | 'team' | 'enterprise';
            }
          } catch (error: any) {
            console.warn('[LLM Executor] Failed to fetch organization plan:', error);
            // Default to free plan if fetch fails
          }
        }

        // Apply cost tiering
        const tieringResult = guardrailsService.applyCostTiering({
          plan: organizationPlan,
          requestedModel: modelName,
          provider,
        });

        span.setAttributes({
          'guardrails.plan': tieringResult.plan,
          'guardrails.original_model': tieringResult.originalModel,
          'guardrails.recommended_model': tieringResult.recommendedModel,
          'guardrails.model_downgraded': tieringResult.downgraded,
          'guardrails.tiering_reason': tieringResult.reason,
        });

        // Update model if downgraded
        if (tieringResult.downgraded && tieringResult.recommendedModel !== modelName) {
          const originalModelName = modelName;
          modelName = tieringResult.recommendedModel;
          
          span.setAttributes({
            'guardrails.model_changed': true,
            'guardrails.original_model_requested': originalModelName,
            'guardrails.final_model': modelName,
          });

          // Log the downgrade
          console.log(`[LLM Executor] Cost tiering: ${tieringResult.plan} plan - ${originalModelName} → ${modelName}`);
        }
      }
    } catch (error: any) {
      console.warn('[LLM Executor] Cost tiering check failed:', error);
      // Continue execution if cost tiering fails
    }

    // Guardrails: Determine region-based routing (skip if ArchGW already handled it)
    try {
      const enableRegionRouting = await featureFlagService.isEnabled(
        'enable_region_routing',
        context.userId,
        (context as any).workspaceId
      );

      // Skip individual checks if ArchGW already handled routing
      const skipIndividualChecks = routingDecision && routingDecision.factors?.includes('region_routing');

      if (enableRegionRouting && !skipIndividualChecks) {
        // Get compliance requirements from organization settings or node config
        let complianceRequirements: string[] = [];
        const organizationId = (context as any).organizationId;
        
        if (organizationId) {
          try {
            const [org] = await db
              .select({ settings: organizations.settings })
              .from(organizations)
              .where(eq(organizations.id, organizationId))
              .limit(1);
            
            if (org?.settings && typeof org.settings === 'object') {
              const settings = org.settings as any;
              complianceRequirements = settings.complianceRequirements || [];
            }
          } catch (error: any) {
            console.warn('[LLM Executor] Failed to fetch organization compliance requirements:', error);
          }
        }

        // Merge with node config compliance requirements
        if (nodeConfig.complianceRequirements) {
          complianceRequirements = [
            ...complianceRequirements,
            ...(Array.isArray(nodeConfig.complianceRequirements) 
              ? nodeConfig.complianceRequirements 
              : [nodeConfig.complianceRequirements])
          ];
        }

        const regionRouting = guardrailsService.determineRegionRouting({
          userId: context.userId || undefined,
          organizationId: (context as any).organizationId || undefined,
          workspaceId: (context as any).workspaceId || undefined,
          userRegion: nodeConfig.userRegion || (context as any).userRegion,
          dataResidency: nodeConfig.dataResidency || (context as any).dataResidency,
          complianceRequirements: complianceRequirements.length > 0 ? complianceRequirements : undefined,
          preferredRegion: nodeConfig.preferredRegion || (context as any).preferredRegion,
          provider,
          enforceCompliance: nodeConfig.enforceCompliance !== false, // Default to true
        });

        span.setAttributes({
          'guardrails.routing_region': regionRouting.region,
          'guardrails.routing_reason': regionRouting.reason,
          'guardrails.requires_compliance': regionRouting.requiresCompliance || false,
          'guardrails.data_residency': regionRouting.dataResidency || 'none',
        });

        // Log routing decision (could be used to route actual API calls)
        if (regionRouting.endpoint) {
          span.setAttributes({
            'guardrails.routing_endpoint': regionRouting.endpoint,
          });
        }

        // Note: In a full implementation, we would use the endpoint for API calls
        // For now, we just log the routing decision
      }
    } catch (error: any) {
      console.warn('[LLM Executor] Region routing check failed:', error);
      // Continue execution if region routing fails
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
            prompt,
            knownPrompts,
            context.userId || undefined,
            (context as any).organizationId || undefined,
            (context as any).workspaceId || undefined,
            similarityThreshold,
            'cosine',
            context.executionId || undefined,
            context.nodeId || undefined,
            traceId
          );

          // Always add similarity attributes, whether blocked or passed
          span.setAttributes({
            'guardrails.similarity_check': similarityResult.similar ? 'blocked' : 'passed',
            'guardrails.similarity_score': similarityResult.similarityScore || 0,
            'guardrails.similarity_threshold': similarityThreshold,
            'guardrails.similarity_method': 'cosine',
            'guardrails.similarity_matched_prompts_count': similarityResult.matchedPrompts?.length || 0,
          });

          // Add matched prompts if available (truncated for span attributes)
          if (similarityResult.matchedPrompts && similarityResult.matchedPrompts.length > 0) {
            span.setAttributes({
              'guardrails.similarity_matched_prompts': JSON.stringify(
                similarityResult.matchedPrompts.slice(0, 5).map((p: any) => ({
                  id: p.id,
                  score: p.score,
                }))
              ),
            });
          }

          if (similarityResult.similar) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Prompt similarity check failed' });
            span.end();

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
      console.warn('[LLM Executor] Prompt similarity check failed:', error);
      // Continue execution if similarity check fails
    }

    const llmStartTime = new Date();
    const result = await aiService.generateText({
      prompt,
      config: {
        provider,
        model: modelName,
        temperature: nodeConfig.temperature || 0.7,
        maxTokens: nodeConfig.maxTokens || 1000,
        systemPrompt: nodeConfig.systemPrompt,
      },
      variables: {
        ...input,
        context: input.context,
      },
    });
    const llmEndTime = new Date();

    // Calculate cost details using cost calculation service
    // tokensUsed can be a number or an object with input/output
    let inputTokens = 0;
    let outputTokens = 0;
    
    if (typeof result.tokensUsed === 'number') {
      // If it's a number, try to get breakdown from metadata
      const metadata = result.metadata as any;
      const tokenUsage = metadata?.tokenUsage || metadata?.usage;
      if (tokenUsage) {
        inputTokens = tokenUsage.promptTokens || tokenUsage.inputTokens || 0;
        outputTokens = tokenUsage.completionTokens || tokenUsage.outputTokens || 0;
      } else {
        // If no breakdown, estimate 60/40 split (input/output) as a rough approximation
        inputTokens = Math.floor(result.tokensUsed * 0.6);
        outputTokens = result.tokensUsed - inputTokens;
      }
    } else if (result.tokensUsed && typeof result.tokensUsed === 'object') {
      inputTokens = (result.tokensUsed as any).input || 0;
      outputTokens = (result.tokensUsed as any).output || 0;
    }
    
    // Use cost calculation service to calculate accurate costs
    const costResult = costCalculationService.calculate({
      provider,
      model: modelName,
      inputTokens,
      outputTokens,
    });
    
    const totalTokens = costResult.totalTokens;
    const cost = costResult.totalCost; // Use calculated cost instead of result.cost
    const ratePer1k = costResult.ratePer1k;
    const costUsdCents = costResult.costUsdCents;

    const latencyMs = Date.now() - startTime;

    // Guardrails: Validate output with JSON Schema (if enabled and schema provided)
    let validatedOutput: any = result.content;
    try {
      const enableJSONSchemaValidation = await featureFlagService.isEnabled(
        'enable_json_schema_validation',
        context.userId,
        (context as any).workspaceId
      );

      if (enableJSONSchemaValidation && (nodeConfig.jsonSchema || nodeConfig.outputSchema)) {
        const jsonSchema = nodeConfig.jsonSchema || nodeConfig.outputSchema;
        
        // Try to parse output as JSON if it's a string
        let outputToValidate: any = result.content;
        if (typeof result.content === 'string') {
          try {
            outputToValidate = JSON.parse(result.content);
          } catch {
            // If parsing fails, validate as string
            outputToValidate = result.content;
          }
        }

        const validationResult = await guardrailsService.validateOutputWithJSONSchema(
          outputToValidate,
          jsonSchema,
          {
            coerceTypes: nodeConfig.coerceTypes !== false,
            removeAdditional: nodeConfig.removeAdditional === true,
            useDefaults: nodeConfig.useDefaults !== false,
            policies: nodeConfig.validationPolicies,
            useAPI: nodeConfig.useGuardrailsAIAPI === true,
            apiUrl: nodeConfig.guardrailsAIAPIUrl,
            apiKey: nodeConfig.guardrailsAIAPIKey,
          }
        );

        span.setAttributes({
          'guardrails.json_schema_validation': validationResult.valid ? 'passed' : 'failed',
        });

        if (validationResult.warnings && validationResult.warnings.length > 0) {
          span.setAttributes({
            'guardrails.json_schema_warnings': validationResult.warnings.join('; '),
          });
        }

        if (!validationResult.valid) {
          span.setAttributes({
            'guardrails.json_schema_errors': validationResult.errors?.join('; ') || '',
          });

          // If strict validation is enabled, fail the request
          if (nodeConfig.strictJSONSchemaValidation === true) {
            span.setStatus({ 
              code: SpanStatusCode.ERROR, 
              message: 'JSON Schema validation failed' 
            });
            span.end();

            return {
              success: false,
              error: {
                message: `JSON Schema validation failed: ${validationResult.errors?.join(', ')}`,
                code: 'JSON_SCHEMA_VALIDATION_ERROR',
                details: {
                  errors: validationResult.errors,
                  warnings: validationResult.warnings,
                  output: result.content,
                },
              },
            };
          } else {
            // Log warning but continue
            console.warn('[LLM Executor] JSON Schema validation failed:', validationResult.errors);
          }
        } else if (validationResult.data !== undefined) {
          // Use validated/coerced data
          validatedOutput = validationResult.data;
          span.setAttributes({
            'guardrails.json_schema_coerced': true,
          });
        }
      }
    } catch (error: any) {
      console.warn('[LLM Executor] JSON Schema validation failed:', error);
      // Continue execution if validation fails
    }

    // Update span with LLM execution details including enhanced cost and similarity data
    span.setAttributes({
      'llm.input_tokens': inputTokens,
      'llm.output_tokens': outputTokens,
      'llm.total_tokens': totalTokens,
      'llm.cost_usd': cost,
      'llm.cost_input_usd': costResult.inputCost || 0,
      'llm.cost_output_usd': costResult.outputCost || 0,
      'llm.rate_per_1k_input': costResult.ratePer1k?.input || 0,
      'llm.rate_per_1k_output': costResult.ratePer1k?.output || 0,
      'llm.cost_usd_cents': costUsdCents || 0,
      'llm.latency_ms': latencyMs,
      'llm.status': 'success',
      // Cost efficiency metrics
      'llm.cost_per_token': totalTokens > 0 ? cost / totalTokens : 0,
      'llm.tokens_per_second': latencyMs > 0 ? (totalTokens / (latencyMs / 1000)) : 0,
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    // Write to model_cost_logs (if feature flag enabled)
    try {
      const trackCosts = await featureFlagService.isEnabled(
        'track_model_costs',
        context.userId,
        (context as any).workspaceId
      );
      
      if (trackCosts) {
        await db.insert(modelCostLogs).values({
          id: createId(),
          userId: context.userId || null,
          agentId: null, // Will be set if this is a code agent execution
          workflowExecutionId: context.executionId || null,
          nodeId: context.nodeId || null,
          modelName: modelName,
          provider: provider,
          inputTokens,
          outputTokens,
          tokensTotal: totalTokens,
          ratePer1k: ratePer1k || null,
          costUsd: costUsdCents,
          usdCost: cost.toString(), // Store as decimal
          prompt: prompt.length > 1000 ? prompt.substring(0, 1000) + '...' : prompt, // Truncate if too long
          response: result.content.length > 1000 ? result.content.substring(0, 1000) + '...' : result.content, // Truncate if too long
          traceId: traceId || null,
          organizationId: (context as any).organizationId || null,
          workspaceId: (context as any).workspaceId || null,
          timestamp: new Date(),
          createdAt: new Date(),
        });
      }
    } catch (err: any) {
      console.error('[LLM Executor] Failed to write cost log:', err);
      // Don't throw - observability should not break execution
    }

    // Export to Langfuse (async, non-blocking)
    if (langfuseService.isEnabled()) {
      langfuseService.exportLLMCall({
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        parentSpanId: spanContext.parentSpanId,
        provider,
        model: modelName,
        prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
        response: typeof result.content === 'string' ? result.content : JSON.stringify(result.content || result),
        startTime: llmStartTime,
        endTime: llmEndTime,
        cost,
        tokens: {
          prompt: inputTokens,
          completion: outputTokens,
          total: totalTokens,
        },
        metadata: {
          temperature: nodeConfig.temperature || 0.7,
          maxTokens: nodeConfig.maxTokens || 1000,
          userId: context.userId,
          workspaceId: (context as any).workspaceId,
          organizationId: (context as any).organizationId,
        },
      }).then((langfuseUrl) => {
        // Add Langfuse trace URL to span attributes for linking
        if (langfuseUrl) {
          span.setAttributes({
            'langfuse.traceUrl': langfuseUrl,
            'langfuse.traceId': spanContext.traceId,
          });
        }
      }).catch((err: any) => {
        // Log but don't throw - Langfuse export should not break execution
        console.warn('[LLM Executor] Langfuse export failed:', err);
      });
    }

    return {
      success: true,
      output: {
        text: result.content,
        tokens: result.tokensUsed,
      },
      metadata: {
        tokensUsed: result.tokensUsed,
        cost: cost,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost: costResult.inputCost,
        outputCost: costResult.outputCost,
      },
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    const llmEndTime = new Date();

    // Update span with error (still include cost/similarity data if available)
    span.setAttributes({
      'llm.status': 'error',
      'llm.latency_ms': latencyMs,
      'llm.error': error.message || 'LLM execution failed',
      'llm.error_code': error.code || 'LLM_ERROR',
      // Include any cost data that might have been calculated before the error
      'llm.cost_usd': 0, // No cost for failed requests
      'llm.total_tokens': 0, // No tokens for failed requests
    });
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message || 'LLM execution failed',
    });
    span.end();

    // Export error to Langfuse (async, non-blocking)
    if (langfuseService.isEnabled()) {
      langfuseService.exportLLMCall({
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        parentSpanId: spanContext.parentSpanId,
        provider,
        model: modelName,
        prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
        startTime: llmStartTime,
        endTime: llmEndTime,
        error: error.message || 'LLM execution failed',
        metadata: {
          temperature: nodeConfig.temperature || 0.7,
          maxTokens: nodeConfig.maxTokens || 1000,
          userId: context.userId,
          workspaceId: (context as any).workspaceId,
          organizationId: (context as any).organizationId,
        },
      }).then((langfuseUrl) => {
        // Add Langfuse trace URL to span attributes for linking
        if (langfuseUrl) {
          span.setAttributes({
            'langfuse.traceUrl': langfuseUrl,
            'langfuse.traceId': spanContext.traceId,
          });
        }
      }).catch((err: any) => {
        console.warn('[LLM Executor] Langfuse export failed:', err);
      });
    }

    return {
      success: false,
      error: {
        message: error.message || 'LLM execution failed',
        code: 'LLM_ERROR',
        details: error,
      },
    };
  }
}

