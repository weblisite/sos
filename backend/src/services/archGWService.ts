/**
 * ArchGW (Architecture Gateway) Service
 * 
 * High-level routing service that orchestrates prompt routing decisions
 * based on prompt length, region, cost, compliance, and other factors.
 * 
 * This service integrates with:
 * - GuardrailsService for validation and routing rules
 * - Feature flags for enabling/disabling routing features
 * - Organization settings for compliance and preferences
 */

import { guardrailsService, PromptLengthResult, RegionRoutingResult, CostTieringResult, ValidationResult } from './guardrailsService';
import { guardrailsAIService, GuardrailsAIOptions } from './guardrailsAIService';
import { policyEngineService, PolicyContext, PolicyEvaluationResult } from './policyEngineService';
import { retryService } from './retryService';
import { featureFlagService } from './featureFlagService';
import { db } from '../config/database';
import { organizations } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Provider types supported by ArchGW
 */
export type LLMProvider = 'openai' | 'anthropic' | 'google';

/**
 * Routing decision result
 */
export interface RoutingDecision {
  // Model selection
  provider: LLMProvider;
  model: string;
  originalModel?: string; // Original requested model if changed
  
  // Routing information
  region: string;
  endpoint?: string;
  
  // Decision metadata
  reason: string;
  factors: string[]; // Factors that influenced the decision
  
  // Validation results
  promptLength?: PromptLengthResult;
  regionRouting?: RegionRoutingResult;
  costTiering?: CostTieringResult;
  
  // Compliance
  requiresCompliance?: boolean;
  dataResidency?: string;
  complianceRequirements?: string[];
  
  // Cost information
  estimatedCost?: number;
  costTier?: 'free' | 'pro' | 'team' | 'enterprise';
  
  // Warnings and errors
  warnings?: string[];
  errors?: string[];
  
  // GuardrailsAI validation results
  inputValidation?: ValidationResult;
  outputValidation?: ValidationResult;
  
  // Policy evaluation results
  policyEvaluation?: PolicyEvaluationResult;
  
  // Reroute information
  fallbackRegions?: string[];
  fallbackProviders?: LLMProvider[];
}

/**
 * Routing options
 */
export interface RoutingOptions {
  // Context
  userId?: string;
  organizationId?: string;
  workspaceId?: string;
  
  // Prompt information
  prompt: string;
  promptLength?: number; // Pre-calculated length (optional)
  
  // Model preferences
  requestedProvider?: LLMProvider;
  requestedModel?: string;
  
  // Regional preferences
  userRegion?: string;
  preferredRegion?: string;
  dataResidency?: string;
  complianceRequirements?: string[];
  
  // Cost preferences
  organizationPlan?: 'free' | 'pro' | 'team' | 'enterprise';
  maxCost?: number; // Maximum cost per request (optional)
  
  // Feature flags
  enableCostTiering?: boolean;
  enableRegionRouting?: boolean;
  enablePromptLengthRouting?: boolean;
  enforceCompliance?: boolean;
  
  // Advanced options
  allowModelDowngrade?: boolean;
  strictCompliance?: boolean; // Fail if compliance cannot be met
  enableReroute?: boolean; // Enable automatic rerouting on failure
  
  // Reroute configuration
  fallbackRegions?: string[];
  fallbackProviders?: LLMProvider[];
  
  // GuardrailsAI validation options
  validateInput?: boolean; // Validate input prompt
  validateOutput?: boolean; // Validate output (requires outputSchema or outputPolicies)
  inputSchema?: Record<string, any> | string; // JSON Schema for input validation
  outputSchema?: Record<string, any> | string; // JSON Schema for output validation
  inputPolicies?: GuardrailsAIOptions['policies']; // Policies for input validation
  outputPolicies?: GuardrailsAIOptions['policies']; // Policies for output validation
  usePredefinedPolicies?: string | string[]; // Predefined policy sets to use
  strictValidation?: boolean; // Fail if validation fails
}

/**
 * ArchGW Service
 * 
 * Architecture Gateway for intelligent prompt routing
 */
export class ArchGWService {
  /**
   * Determine optimal routing for a prompt
   * 
   * This is the main entry point for routing decisions.
   * It considers:
   * - Prompt length → model selection
   * - User region → endpoint routing
   * - Organization plan → cost tiering
   * - Compliance requirements → region/data residency
   * - Feature flags → enable/disable features
   */
  async routePrompt(options: RoutingOptions): Promise<RoutingDecision> {
    const {
      userId,
      organizationId,
      workspaceId,
      prompt,
      requestedProvider = 'openai',
      requestedModel = 'gpt-4',
      userRegion,
      preferredRegion,
      dataResidency,
      complianceRequirements,
      organizationPlan,
      enableCostTiering,
      enableRegionRouting,
      enablePromptLengthRouting,
      enforceCompliance = true,
      allowModelDowngrade = true,
      strictCompliance = false,
    } = options;

    const factors: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // Fetch organization settings if organizationId is provided
    let orgPlan: 'free' | 'pro' | 'team' | 'enterprise' = organizationPlan || 'free';
    let orgComplianceRequirements: string[] = complianceRequirements || [];
    let orgDataResidency: string | undefined = dataResidency;

    if (organizationId) {
      try {
        const [org] = await db
          .select({
            plan: organizations.plan,
            settings: organizations.settings,
          })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);

        if (org) {
          orgPlan = (org.plan as 'free' | 'pro' | 'team' | 'enterprise') || 'free';
          
          if (org.settings && typeof org.settings === 'object') {
            const settings = org.settings as any;
            orgComplianceRequirements = settings.complianceRequirements || orgComplianceRequirements;
            orgDataResidency = settings.dataResidency || orgDataResidency;
          }
        }
      } catch (error: any) {
        console.warn('[ArchGW] Failed to fetch organization settings:', error);
        warnings.push('Could not fetch organization settings, using defaults');
      }
    }

    // Check feature flags
    const costTieringEnabled = enableCostTiering !== undefined
      ? enableCostTiering
      : await featureFlagService.isEnabled('enable_cost_tiering', userId, workspaceId);
    
    const regionRoutingEnabled = enableRegionRouting !== undefined
      ? enableRegionRouting
      : await featureFlagService.isEnabled('enable_region_routing', userId, workspaceId);
    
    const promptLengthRoutingEnabled = enablePromptLengthRouting !== undefined
      ? enablePromptLengthRouting
      : await featureFlagService.isEnabled('enable_prompt_length_routing', userId, workspaceId);

    // Step 1: Check prompt length and get recommendations
    let promptLengthResult: PromptLengthResult | undefined;
    if (promptLengthRoutingEnabled) {
      try {
        promptLengthResult = guardrailsService.checkPromptLength(prompt, {
          model: requestedModel,
          provider: requestedProvider,
        });
        factors.push('prompt_length');
        
        if (promptLengthResult.recommendedModel && promptLengthResult.recommendedModel !== requestedModel) {
          factors.push('model_selection_by_length');
        }
      } catch (error: any) {
        console.warn('[ArchGW] Prompt length check failed:', error);
        warnings.push('Prompt length check failed');
      }
    }

    // Step 2: Determine region routing
    let regionRoutingResult: RegionRoutingResult | undefined;
    let finalRegion = preferredRegion || userRegion || 'us-east';
    let finalEndpoint: string | undefined;
    
    if (regionRoutingEnabled) {
      try {
        regionRoutingResult = guardrailsService.determineRegionRouting({
          userId,
          organizationId,
          workspaceId,
          userRegion,
          dataResidency: orgDataResidency || dataResidency,
          complianceRequirements: orgComplianceRequirements.length > 0 
            ? orgComplianceRequirements 
            : complianceRequirements,
          preferredRegion,
          provider: requestedProvider,
          enforceCompliance,
        });
        
        finalRegion = regionRoutingResult.region;
        finalEndpoint = regionRoutingResult.endpoint;
        factors.push('region_routing');
        
        if (regionRoutingResult.requiresCompliance) {
          factors.push('compliance_routing');
        }
      } catch (error: any) {
        console.warn('[ArchGW] Region routing check failed:', error);
        warnings.push('Region routing check failed');
        
        if (strictCompliance && enforceCompliance) {
          errors.push('Compliance requirements could not be met');
        }
      }
    }

    // Step 3: Apply cost tiering
    let costTieringResult: CostTieringResult | undefined;
    let finalModel = requestedModel;
    let finalProvider = requestedProvider;
    
    if (costTieringEnabled) {
      try {
        costTieringResult = guardrailsService.applyCostTiering({
          plan: orgPlan,
          requestedModel,
          provider: requestedProvider,
        });
        
        factors.push('cost_tiering');
        
        if (costTieringResult.downgraded && allowModelDowngrade) {
          finalModel = costTieringResult.recommendedModel;
          factors.push('model_downgrade');
        } else if (costTieringResult.downgraded && !allowModelDowngrade) {
          warnings.push(`Model downgrade recommended but not allowed: ${costTieringResult.reason}`);
        }
      } catch (error: any) {
        console.warn('[ArchGW] Cost tiering check failed:', error);
        warnings.push('Cost tiering check failed');
      }
    }

    // Step 4: Apply prompt length recommendations with conflict resolution
    if (promptLengthRoutingEnabled && promptLengthResult?.recommendedModel) {
      // Resolve conflicts between cost tiering and prompt length recommendations
      const lengthRecommendedModel = promptLengthResult.recommendedModel;
      
      if (costTieringResult) {
        // If cost tiering already changed the model, check if length recommendation is better
        if (costTieringResult.downgraded) {
          // Cost tiering took priority, but check if we can use length recommendation
          // if it's still within the allowed models for the plan
          const allowedModels = costTieringResult.allowedModels || [];
          if (allowedModels.includes(lengthRecommendedModel)) {
            // Use length recommendation if it's allowed by cost tier
            finalModel = lengthRecommendedModel;
            factors.push('model_selection_by_length');
            factors.push('length_optimized_within_tier');
          } else {
            // Keep cost tier recommendation, but note the conflict
            warnings.push(`Prompt length recommends ${lengthRecommendedModel}, but cost tier restricts to ${costTieringResult.recommendedModel}`);
          }
        } else {
          // Cost tiering didn't change model, apply length recommendation
          if (finalModel === requestedModel) {
            finalModel = lengthRecommendedModel;
            factors.push('model_selection_by_length');
          }
        }
      } else {
        // No cost tiering, apply length recommendation directly
        if (finalModel === requestedModel) {
          finalModel = lengthRecommendedModel;
          factors.push('model_selection_by_length');
        }
      }
    }

    // Step 5: Apply multi-factor optimization
    // Consider prompt characteristics for final model selection
    const optimizedModel = this.optimizeModelSelection({
      currentModel: finalModel,
      provider: finalProvider,
      promptLength: prompt.length,
      tokenEstimate: promptLengthResult?.tokenEstimate,
      costTier: orgPlan,
      complianceRequired: regionRoutingResult?.requiresCompliance || false,
      allowedModels: costTieringResult?.allowedModels,
    });

    if (optimizedModel && optimizedModel !== finalModel) {
      factors.push('multi_factor_optimization');
      finalModel = optimizedModel;
    }

    // Step 6: Estimate cost for the selected model
    const estimatedCost = this.estimateCost({
      model: finalModel,
      provider: finalProvider,
      promptLength: prompt.length,
      tokenEstimate: promptLengthResult?.tokenEstimate,
    });

    // Step 7: Validate final decision
    const validationResult = this.validateRoutingDecision({
      model: finalModel,
      provider: finalProvider,
      region: finalRegion,
      complianceRequired: regionRoutingResult?.requiresCompliance || false,
      maxCost: options.maxCost,
      estimatedCost,
      strictCompliance,
    });

    if (validationResult.errors && validationResult.errors.length > 0) {
      errors.push(...validationResult.errors);
    }

    if (validationResult.warnings && validationResult.warnings.length > 0) {
      warnings.push(...validationResult.warnings);
    }

    // Step 8: Evaluate routing policies (if enabled)
    let policyEvaluation: PolicyEvaluationResult | undefined;
    try {
      const enablePolicyEngine = await featureFlagService.isEnabled(
        'enable_policy_engine',
        userId,
        workspaceId
      );

      if (enablePolicyEngine) {
        const policyContext: PolicyContext = {
          userId,
          organizationId,
          workspaceId,
          userPlan: orgPlan,
          prompt,
          promptLength: prompt.length,
          requestedModel,
          requestedProvider,
          estimatedCost,
          region: finalRegion,
          complianceRequirements: orgComplianceRequirements.length > 0 
            ? orgComplianceRequirements 
            : complianceRequirements,
          dataResidency: orgDataResidency || dataResidency,
        };

        policyEvaluation = await policyEngineService.evaluatePolicies(policyContext, {
          organizationId,
          workspaceId,
        });

        // Apply policy actions
        if (policyEvaluation.blocked) {
          errors.push(policyEvaluation.reason || 'Request blocked by policy');
        }

        if (policyEvaluation.warnings && policyEvaluation.warnings.length > 0) {
          warnings.push(...policyEvaluation.warnings);
        }

        // Apply routing modifications from policies
        if (policyEvaluation.modifiedContext) {
          if (policyEvaluation.modifiedContext.requestedModel) {
            finalModel = policyEvaluation.modifiedContext.requestedModel;
            factors.push('policy_routing');
          }
          if (policyEvaluation.modifiedContext.requestedProvider) {
            finalProvider = policyEvaluation.modifiedContext.requestedProvider as LLMProvider;
            factors.push('policy_routing');
          }
          if (policyEvaluation.modifiedContext.region) {
            finalRegion = policyEvaluation.modifiedContext.region;
            factors.push('policy_routing');
          }
        }

        if (policyEvaluation.matched) {
          factors.push('policy_evaluation');
        }
      }
    } catch (error: any) {
      console.warn('[ArchGW] Policy evaluation failed:', error);
      warnings.push('Policy evaluation failed');
    }

    // Step 9: GuardrailsAI input validation (if enabled)
    let inputValidation: ValidationResult | undefined;
    if (options.validateInput) {
      try {
        // Build policies from config
        let inputPolicies = options.inputPolicies;
        
        // Add predefined policies if specified
        if (options.usePredefinedPolicies) {
          const predefinedPolicies = guardrailsService.getPredefinedPolicies();
          const policySets = Array.isArray(options.usePredefinedPolicies)
            ? options.usePredefinedPolicies
            : [options.usePredefinedPolicies];
          
          const allPolicies: any[] = inputPolicies || [];
          for (const policySet of policySets) {
            if (predefinedPolicies[policySet]) {
              allPolicies.push(...predefinedPolicies[policySet]);
            }
          }
          inputPolicies = allPolicies;
        }

        if (options.inputSchema) {
          // Validate with JSON Schema
          inputValidation = await guardrailsService.validateOutputWithJSONSchema(
            prompt,
            options.inputSchema,
            {
              policies: inputPolicies,
            }
          );
        } else if (inputPolicies && inputPolicies.length > 0) {
          // Validate with policies only
          inputValidation = await guardrailsService.validateOutputWithPolicies(
            prompt,
            inputPolicies
          );
        }

        if (inputValidation && !inputValidation.valid) {
          if (options.strictValidation) {
            errors.push(`Input validation failed: ${inputValidation.errors?.join(', ')}`);
          } else {
            warnings.push(`Input validation warnings: ${inputValidation.errors?.join(', ')}`);
          }
        }
      } catch (error: any) {
        console.warn('[ArchGW] Input validation failed:', error);
        if (options.strictValidation) {
          errors.push(`Input validation error: ${error.message}`);
        } else {
          warnings.push(`Input validation error: ${error.message}`);
        }
      }
    }

    // Step 10: Determine fallback regions and providers for rerouting
    const fallbackRegions: string[] = [];
    const fallbackProviders: LLMProvider[] = [];

    if (options.enableReroute !== false) {
      // Add fallback regions from options or determine based on compliance
      if (options.fallbackRegions && options.fallbackRegions.length > 0) {
        fallbackRegions.push(...options.fallbackRegions);
      } else {
        // Default fallback regions based on compliance requirements
        if (orgComplianceRequirements.includes('GDPR') || orgDataResidency === 'EU') {
          fallbackRegions.push('eu-west-1', 'eu-central-1');
        }
        if (orgComplianceRequirements.includes('HIPAA') || orgDataResidency === 'US') {
          fallbackRegions.push('us-east-1', 'us-west-2');
        }
        // Add global fallbacks
        if (!fallbackRegions.includes('us-east-1')) {
          fallbackRegions.push('us-east-1');
        }
        if (!fallbackRegions.includes('eu-west-1')) {
          fallbackRegions.push('eu-west-1');
        }
      }

      // Add fallback providers from options
      if (options.fallbackProviders && options.fallbackProviders.length > 0) {
        fallbackProviders.push(...options.fallbackProviders);
      } else {
        // Default fallback providers
        const allProviders: LLMProvider[] = ['openai', 'anthropic', 'google'];
        for (const p of allProviders) {
          if (p !== finalProvider) {
            fallbackProviders.push(p);
          }
        }
      }
    }

    // Step 11: Build final routing decision
    const decision: RoutingDecision = {
      provider: finalProvider,
      model: finalModel,
      originalModel: finalModel !== requestedModel ? requestedModel : undefined,
      region: finalRegion,
      endpoint: finalEndpoint,
      reason: this.buildReason(factors, costTieringResult, regionRoutingResult, promptLengthResult),
      factors,
      promptLength: promptLengthResult,
      regionRouting: regionRoutingResult,
      costTiering: costTieringResult,
      requiresCompliance: regionRoutingResult?.requiresCompliance || false,
      dataResidency: regionRoutingResult?.dataResidency || orgDataResidency || dataResidency,
      complianceRequirements: orgComplianceRequirements.length > 0 
        ? orgComplianceRequirements 
        : complianceRequirements,
      costTier: orgPlan,
      estimatedCost,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
      inputValidation,
      policyEvaluation,
      fallbackRegions: fallbackRegions.length > 0 ? fallbackRegions : undefined,
      fallbackProviders: fallbackProviders.length > 0 ? fallbackProviders : undefined,
    };

    // If blocked by policy, return early
    if (policyEvaluation?.blocked) {
      return decision;
    }

    return decision;
  }

  /**
   * Reroute a failed request using StackStorm or fallback logic
   */
  async rerouteRequest(
    originalDecision: RoutingDecision,
    failureReason: string,
    options: {
      userId?: string;
      workspaceId?: string;
      useStackStorm?: boolean;
    } = {}
  ): Promise<RoutingDecision | null> {
    const { userId, workspaceId, useStackStorm = true } = options;

    // Check if reroute is enabled and fallbacks are available
    if (!originalDecision.fallbackRegions && !originalDecision.fallbackProviders) {
      return null; // No fallbacks available
    }

    // Check if StackStorm reroute should be used
    let enableStackStormReroute = useStackStorm;
    if (enableStackStormReroute) {
      try {
        enableStackStormReroute = await featureFlagService.isEnabled(
          'enable_stackstorm_reroute',
          userId,
          workspaceId
        );
      } catch (error: any) {
        console.warn('[ArchGW] Failed to check StackStorm reroute feature flag:', error);
        enableStackStormReroute = false;
      }
    }

    if (enableStackStormReroute) {
      try {
        const rerouteResult = await retryService.retryWithReroute(
          async (region?: string, provider?: string) => {
            // This function would be called with different region/provider combinations
            // For now, we return a new routing decision
            return {
              ...originalDecision,
              region: region || originalDecision.region,
              provider: (provider as LLMProvider) || originalDecision.provider,
            };
          },
          {
            originalRegion: originalDecision.region,
            originalProvider: originalDecision.provider,
            fallbackRegions: originalDecision.fallbackRegions || [],
            fallbackProviders: originalDecision.fallbackProviders || [],
            useStackStorm: true,
            userId,
            workspaceId,
          }
        );

        if (rerouteResult.success && rerouteResult.result) {
          return rerouteResult.result;
        }
      } catch (error: any) {
        console.warn('[ArchGW] StackStorm reroute failed, falling back to simple reroute:', error);
      }
    }

    // Fallback to simple reroute logic
    return this.simpleReroute(originalDecision, failureReason);
  }

  /**
   * Simple reroute logic (fallback when StackStorm is unavailable)
   */
  private simpleReroute(
    originalDecision: RoutingDecision,
    failureReason: string
  ): RoutingDecision | null {
    // Try fallback regions first
    if (originalDecision.fallbackRegions && originalDecision.fallbackRegions.length > 0) {
      const nextRegion = originalDecision.fallbackRegions[0];
      return {
        ...originalDecision,
        region: nextRegion,
        reason: `Rerouted to ${nextRegion} due to: ${failureReason}`,
        factors: [...(originalDecision.factors || []), 'reroute_region'],
      };
    }

    // Try fallback providers
    if (originalDecision.fallbackProviders && originalDecision.fallbackProviders.length > 0) {
      const nextProvider = originalDecision.fallbackProviders[0];
      return {
        ...originalDecision,
        provider: nextProvider,
        reason: `Rerouted to ${nextProvider} due to: ${failureReason}`,
        factors: [...(originalDecision.factors || []), 'reroute_provider'],
      };
    }

    return null; // No reroute possible
  }

  /**
   * Validate LLM output using GuardrailsAI
   * 
   * This method can be called after LLM execution to validate the output
   * against JSON Schema and/or policies.
   */
  async validateOutput(
    output: unknown,
    options: {
      outputSchema?: Record<string, any> | string;
      outputPolicies?: GuardrailsAIOptions['policies'];
      usePredefinedPolicies?: string | string[];
      strictValidation?: boolean;
    } = {}
  ): Promise<ValidationResult> {
    try {
      // Build policies from config
      let outputPolicies = options.outputPolicies;
      
      // Add predefined policies if specified
      if (options.usePredefinedPolicies) {
        const predefinedPolicies = guardrailsService.getPredefinedPolicies();
        const policySets = Array.isArray(options.usePredefinedPolicies)
          ? options.usePredefinedPolicies
          : [options.usePredefinedPolicies];
        
        const allPolicies: any[] = outputPolicies || [];
        for (const policySet of policySets) {
          if (predefinedPolicies[policySet]) {
            allPolicies.push(...predefinedPolicies[policySet]);
          }
        }
        outputPolicies = allPolicies;
      }

      if (options.outputSchema) {
        // Validate with JSON Schema
        return await guardrailsService.validateOutputWithJSONSchema(
          output,
          options.outputSchema,
          {
            policies: outputPolicies,
          }
        );
      } else if (outputPolicies && outputPolicies.length > 0) {
        // Validate with policies only
        return await guardrailsService.validateOutputWithPolicies(
          output,
          outputPolicies
        );
      }

      // No validation configured
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: [`Output validation failed: ${error.message}`],
      };
    }
  }

  /**
   * Optimize model selection based on multiple factors
   * 
   * This method applies heuristics to select the best model considering:
   * - Prompt length and complexity
   * - Cost constraints
   * - Performance requirements
   * - Compliance needs
   */
  private optimizeModelSelection(options: {
    currentModel: string;
    provider: LLMProvider;
    promptLength: number;
    tokenEstimate?: number;
    costTier: 'free' | 'pro' | 'team' | 'enterprise';
    complianceRequired: boolean;
    allowedModels?: string[];
  }): string | null {
    const {
      currentModel,
      provider,
      promptLength,
      tokenEstimate,
      costTier,
      complianceRequired,
      allowedModels,
    } = options;

    // If we have allowed models, ensure we stay within them
    if (allowedModels && !allowedModels.includes(currentModel)) {
      // Find the best allowed model
      return allowedModels[0] || null;
    }

    // For very short prompts (< 100 chars), prefer cheaper models
    if (promptLength < 100 && costTier === 'free') {
      const cheapModels: Record<LLMProvider, string> = {
        openai: 'gpt-3.5-turbo',
        anthropic: 'claude-3-haiku',
        google: 'gemini-1.5-flash',
      };
      
      if (cheapModels[provider] && (!allowedModels || allowedModels.includes(cheapModels[provider]))) {
        return cheapModels[provider];
      }
    }

    // For very long prompts (> 100k chars), prefer models with large context windows
    if (tokenEstimate && tokenEstimate > 32000) {
      const largeContextModels: Record<LLMProvider, string> = {
        openai: 'gpt-4-turbo',
        anthropic: 'claude-3-opus',
        google: 'gemini-1.5-pro',
      };
      
      if (largeContextModels[provider] && (!allowedModels || allowedModels.includes(largeContextModels[provider]))) {
        return largeContextModels[provider];
      }
    }

    // For compliance-required requests, prefer models with better data handling
    if (complianceRequired && costTier !== 'free') {
      // Prefer newer models that may have better compliance features
      const complianceModels: Record<LLMProvider, string> = {
        openai: 'gpt-4-turbo',
        anthropic: 'claude-3-opus',
        google: 'gemini-1.5-pro',
      };
      
      if (complianceModels[provider] && (!allowedModels || allowedModels.includes(complianceModels[provider]))) {
        return complianceModels[provider];
      }
    }

    // No optimization needed
    return null;
  }

  /**
   * Estimate cost for a model and prompt
   * 
   * Returns estimated cost in USD
   */
  private estimateCost(options: {
    model: string;
    provider: LLMProvider;
    promptLength: number;
    tokenEstimate?: number;
  }): number {
    const { model, provider, promptLength, tokenEstimate } = options;
    
    // Rough cost estimates per 1K tokens (input/output average)
    // These are approximate and should be updated based on actual pricing
    const costPer1KTokens: Record<string, number> = {
      // OpenAI
      'gpt-3.5-turbo': 0.0015,
      'gpt-3.5-turbo-16k': 0.003,
      'gpt-4': 0.03,
      'gpt-4-turbo': 0.01,
      'gpt-4o': 0.005,
      
      // Anthropic
      'claude-3-haiku': 0.00025,
      'claude-3-sonnet': 0.003,
      'claude-3-opus': 0.015,
      'claude-instant-1.2': 0.0008,
      
      // Google
      'gemini-pro': 0.0005,
      'gemini-1.5-pro': 0.00125,
      'gemini-1.5-flash': 0.000075,
    };

    const tokens = tokenEstimate || Math.ceil(promptLength / 4);
    const costPerToken = costPer1KTokens[model] || 0.01; // Default to $0.01 per 1K tokens
    
    // Estimate: assume 1:1 input/output ratio for simplicity
    const estimatedTokens = tokens * 2;
    const estimatedCost = (estimatedTokens / 1000) * costPerToken;
    
    return estimatedCost;
  }

  /**
   * Validate routing decision
   */
  private validateRoutingDecision(options: {
    model: string;
    provider: LLMProvider;
    region: string;
    complianceRequired: boolean;
    maxCost?: number;
    estimatedCost: number;
    strictCompliance: boolean;
  }): {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  } {
    const {
      model,
      provider,
      region,
      complianceRequired,
      maxCost,
      estimatedCost,
      strictCompliance,
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check cost limit
    if (maxCost && estimatedCost > maxCost) {
      if (strictCompliance) {
        errors.push(`Estimated cost ($${estimatedCost.toFixed(4)}) exceeds maximum ($${maxCost.toFixed(4)})`);
      } else {
        warnings.push(`Estimated cost ($${estimatedCost.toFixed(4)}) exceeds maximum ($${maxCost.toFixed(4)})`);
      }
    }

    // Validate compliance requirements
    if (complianceRequired && strictCompliance) {
      // Check if region supports compliance
      const complianceRegions = ['eu-west', 'us-east', 'us-central'];
      if (!complianceRegions.includes(region)) {
        errors.push(`Region ${region} may not support required compliance standards`);
      }
    }

    // Validate model/provider combination
    const validModels: Record<LLMProvider, string[]> = {
      openai: ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'],
      anthropic: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus', 'claude-instant-1.2', 'claude-3-5-sonnet'],
      google: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    };

    if (!validModels[provider]?.includes(model)) {
      warnings.push(`Model ${model} may not be valid for provider ${provider}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Build human-readable reason for routing decision
   */
  private buildReason(
    factors: string[],
    costTiering?: CostTieringResult,
    regionRouting?: RegionRoutingResult,
    promptLength?: PromptLengthResult
  ): string {
    const reasons: string[] = [];

    if (costTiering?.downgraded) {
      reasons.push(`Cost tiering: ${costTiering.reason}`);
    }

    if (regionRouting) {
      reasons.push(`Region routing: ${regionRouting.reason}`);
    }

    if (promptLength?.recommendedModel) {
      reasons.push(`Prompt length: ${promptLength.length} chars, recommended ${promptLength.recommendedModel}`);
    }

    if (reasons.length === 0) {
      return 'Default routing (no special factors applied)';
    }

    return reasons.join('; ');
  }

  /**
   * Get recommended model based on prompt length
   * 
   * This is a convenience method that wraps prompt length checking
   */
  getRecommendedModelByLength(prompt: string, provider: LLMProvider = 'openai'): string {
    const result = guardrailsService.checkPromptLength(prompt, {
      provider,
    });
    
    if (result.recommendedModel) {
      return result.recommendedModel;
    }

    // Default models by provider
    const defaultModels: Record<LLMProvider, string> = {
      openai: 'gpt-4',
      anthropic: 'claude-3-opus',
      google: 'gemini-pro',
    };

    return defaultModels[provider];
  }

  /**
   * Get routing decision for a simple prompt (without organization context)
   * 
   * This is a simplified version of routePrompt for cases where
   * you don't have full context
   */
  async routePromptSimple(
    prompt: string,
    requestedModel: string = 'gpt-4',
    provider: LLMProvider = 'openai',
    userRegion?: string
  ): Promise<RoutingDecision> {
    return this.routePrompt({
      prompt,
      requestedModel,
      requestedProvider: provider,
      userRegion,
      enableCostTiering: false,
      enableRegionRouting: !!userRegion,
      enablePromptLengthRouting: true,
      enforceCompliance: false,
    });
  }
}

// Singleton instance
export const archGWService = new ArchGWService();

