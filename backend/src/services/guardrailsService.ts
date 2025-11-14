import { z } from 'zod';
import { posthogService } from './posthogService';
import { featureFlagService } from './featureFlagService';
import { langchainService } from './langchainService';
import { similarityService, SimilarityMethod } from './similarityService';
import { db } from '../config/database';
import { promptSimilarityLogs } from '../../drizzle/schema';
import { createId } from '@paralleldrive/cuid2';

/**
 * Guardrails Service
 * 
 * Provides validation, content safety, and abuse prevention
 * Based on PRD requirements: Pydantic, Zod, GuardrailsAI, Prompt-Similarity filter
 */

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface SafetyResult {
  safe: boolean;
  violations?: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }>;
  score?: number; // 0-1, higher is safer
}

export interface SimilarityResult {
  similar: boolean;
  similarityScore: number; // 0-1, higher is more similar
  matchedPrompts?: string[];
}

export interface AbuseCheckResult {
  isAbuse: boolean;
  abuseType?: string;
  confidence: number; // 0-1
  action: 'allow' | 'warn' | 'block';
}

export interface PromptLengthResult {
  valid: boolean;
  length: number; // Character count
  tokenEstimate?: number; // Estimated token count (rough approximation: ~4 chars per token)
  warnings?: string[];
  errors?: string[];
  recommendedModel?: string; // Model recommendation based on length
  action?: 'allow' | 'warn' | 'block';
}

export interface RegionRoutingResult {
  region: string; // Target region (e.g., 'us-east', 'eu-west', 'asia-pacific')
  endpoint?: string; // Recommended API endpoint for the region
  reason: string; // Reason for routing decision
  requiresCompliance?: boolean; // Whether compliance requirements triggered routing
  dataResidency?: string; // Data residency requirement (e.g., 'EU', 'US', 'global')
}

/**
 * Guardrails Service
 */
export class GuardrailsService {
  private blockedPatterns: RegExp[] = [];
  private suspiciousPatterns: RegExp[] = [];
  private knownAbusePatterns: RegExp[] = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize blocked and suspicious patterns
   */
  private initializePatterns(): void {
    // Blocked patterns (high severity)
    this.blockedPatterns = [
      /(?:^|\s)(?:hack|exploit|bypass|unauthorized|illegal|malware|virus|trojan)(?:\s|$)/i,
      /(?:^|\s)(?:ddos|dos|attack|breach|inject|sql injection|xss)(?:\s|$)/i,
    ];

    // Suspicious patterns (medium severity)
    this.suspiciousPatterns = [
      /(?:^|\s)(?:password|credential|api.?key|secret|token)(?:\s|$)/i,
      /(?:^|\s)(?:delete|drop|truncate|alter|modify)(?:\s|$)/i,
    ];

    // Known abuse patterns
    this.knownAbusePatterns = [
      /(?:spam|scam|phishing|fraud)/i,
      /(?:harass|threat|violence|hate)/i,
    ];
  }

  /**
   * Validate input using Zod schema
   */
  validateInput<T>(
    input: unknown,
    schema: z.ZodSchema<T>
  ): ValidationResult {
    try {
      schema.parse(input);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return {
        valid: false,
        errors: ['Validation failed'],
      };
    }
  }

  /**
   * Validate output using Zod schema
   */
  validateOutput<T>(
    output: unknown,
    schema: z.ZodSchema<T>
  ): ValidationResult {
    return this.validateInput(output, schema);
  }

  /**
   * Check content safety
   */
  checkContentSafety(content: string): SafetyResult {
    const violations: SafetyResult['violations'] = [];
    let score = 1.0;

    // Check blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(content)) {
        violations.push({
          type: 'blocked_pattern',
          severity: 'critical',
          message: 'Content contains blocked patterns',
        });
        score -= 0.5;
      }
    }

    // Check suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(content)) {
        violations.push({
          type: 'suspicious_pattern',
          severity: 'medium',
          message: 'Content contains suspicious patterns',
        });
        score -= 0.2;
      }
    }

    // Check length (very long content might be abuse)
    if (content.length > 100000) {
      violations.push({
        type: 'excessive_length',
        severity: 'low',
        message: 'Content is excessively long',
      });
      score -= 0.1;
    }

    // Check for potential code injection
    if (this.detectCodeInjection(content)) {
      violations.push({
        type: 'code_injection',
        severity: 'high',
        message: 'Potential code injection detected',
      });
      score -= 0.3;
    }

    score = Math.max(0, score);

    return {
      safe: violations.length === 0 || score > 0.5,
      violations: violations.length > 0 ? violations : undefined,
      score,
    };
  }

  /**
   * Generate embedding for a prompt
   */
  async generatePromptEmbedding(prompt: string): Promise<number[]> {
    try {
      return await langchainService.generateEmbedding(prompt);
    } catch (error: any) {
      console.error('[Guardrails] Failed to generate embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Check prompt similarity using embeddings and vector similarity
   */
  async checkPromptSimilarity(
    prompt: string,
    knownPrompts: string[] = [],
    userId?: string,
    organizationId?: string,
    workspaceId?: string,
    threshold: number = 0.85,
    method: SimilarityMethod = 'cosine',
    workflowExecutionId?: string,
    nodeId?: string,
    traceId?: string
  ): Promise<SimilarityResult> {
    if (knownPrompts.length === 0) {
      return {
        similar: false,
        similarityScore: 0,
      };
    }

    try {
      // Generate embedding for the prompt
      const promptEmbedding = await this.generatePromptEmbedding(prompt);

      let maxSimilarity = 0;
      let matchedPrompt: string | undefined;
      let matchedEmbedding: number[] | undefined;

      // Compare with each known prompt
      for (const knownPrompt of knownPrompts) {
        try {
          // Generate embedding for known prompt
          const knownEmbedding = await this.generatePromptEmbedding(knownPrompt);

          // Calculate similarity
          const similarityResult = similarityService.calculate(
            promptEmbedding,
            knownEmbedding,
            method
          );

          const similarity = similarityResult.normalizedScore ?? similarityResult.score;

          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            matchedPrompt = knownPrompt;
            matchedEmbedding = knownEmbedding;
          }
        } catch (error: any) {
          console.warn(`[Guardrails] Failed to compare with known prompt: ${error.message}`);
          // Continue with next prompt
        }
      }

      const isSimilar = maxSimilarity >= threshold;
      const matchedPrompts = matchedPrompt ? [matchedPrompt] : undefined;

      // Log similarity check to database
      try {
        const enableLogging = await featureFlagService.isEnabled(
          'enable_similarity_logging',
          userId,
          workspaceId
        );

        if (enableLogging) {
          await db.insert(promptSimilarityLogs).values({
            id: createId(),
            userId: userId || null,
            workflowExecutionId: workflowExecutionId || null,
            nodeId: nodeId || null,
            prompt,
            promptEmbedding: promptEmbedding as any, // JSONB accepts arrays
            similarityScore: maxSimilarity,
            similarityScorePercent: Math.round(maxSimilarity * 100),
            flaggedReference: matchedPrompt ? createId() : null, // Reference ID
            flaggedContent: matchedPrompt || null,
            flaggedContentEmbedding: matchedEmbedding as any || null,
            actionTaken: isSimilar ? 'blocked' : 'allowed',
            threshold,
            method,
            organizationId: organizationId || null,
            workspaceId: workspaceId || null,
            traceId: traceId || null,
            timestamp: new Date(),
            createdAt: new Date(),
          });
        }
      } catch (error: any) {
        console.error('[Guardrails] Failed to log similarity check:', error);
        // Don't throw - logging failure shouldn't break execution
      }

      // Track prompt blocking in PostHog if blocked (if feature flag enabled)
      if (isSimilar && userId && organizationId) {
        const enableTracing = await featureFlagService.isEnabled(
          'enable_guardrails_tracing',
          userId,
          workspaceId
        );
        
        if (enableTracing) {
          posthogService.trackPromptBlocked({
            userId,
            organizationId,
            workspaceId: workspaceId || undefined,
            matchScore: maxSimilarity,
            source: 'prompt_similarity',
            promptPreview: prompt.substring(0, 100),
            reason: `Similar to known prompt (${(maxSimilarity * 100).toFixed(1)}% similarity)`,
          });
        }
      }

      return {
        similar: isSimilar,
        similarityScore: maxSimilarity,
        matchedPrompts,
      };
    } catch (error: any) {
      console.error('[Guardrails] Prompt similarity check failed:', error);
      // Fallback to word-based similarity if embedding generation fails
      return this.fallbackWordBasedSimilarity(prompt, knownPrompts);
    }
  }

  /**
   * Fallback word-based similarity (used when embedding generation fails)
   */
  private fallbackWordBasedSimilarity(
    prompt: string,
    knownPrompts: string[]
  ): SimilarityResult {
    const promptWords = new Set(prompt.toLowerCase().split(/\s+/));
    let maxSimilarity = 0;
    const matchedPrompts: string[] = [];

    for (const knownPrompt of knownPrompts) {
      const knownWords = new Set(knownPrompt.toLowerCase().split(/\s+/));
      const intersection = new Set([...promptWords].filter(x => knownWords.has(x)));
      const union = new Set([...promptWords, ...knownWords]);
      const similarity = intersection.size / union.size;

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }

      if (similarity > 0.7) {
        matchedPrompts.push(knownPrompt);
      }
    }

    return {
      similar: maxSimilarity > 0.7,
      similarityScore: maxSimilarity,
      matchedPrompts: matchedPrompts.length > 0 ? matchedPrompts : undefined,
    };
  }

  /**
   * Check prompt length and validate against limits
   * 
   * @param prompt - The prompt to check
   * @param options - Configuration options
   * @returns Prompt length validation result
   */
  checkPromptLength(
    prompt: string,
    options: {
      minLength?: number; // Minimum character length (default: 1)
      maxLength?: number; // Maximum character length (default: 100000)
      minTokens?: number; // Minimum token estimate (default: 1)
      maxTokens?: number; // Maximum token estimate (default: 128000 for GPT-4)
      warnThreshold?: number; // Warning threshold as percentage of max (default: 0.8 = 80%)
      model?: string; // Current model being used
      provider?: 'openai' | 'anthropic' | 'google';
    } = {}
  ): PromptLengthResult {
    const {
      minLength = 1,
      maxLength = 100000, // ~25k tokens at 4 chars/token
      minTokens = 1,
      maxTokens = 128000, // GPT-4 context window
      warnThreshold = 0.8,
      model,
      provider = 'openai',
    } = options;

    const length = prompt.length;
    // Rough token estimation: ~4 characters per token (varies by language)
    const tokenEstimate = Math.ceil(length / 4);

    const warnings: string[] = [];
    const errors: string[] = [];
    let recommendedModel: string | undefined;
    let action: 'allow' | 'warn' | 'block' = 'allow';

    // Check minimum length
    if (length < minLength) {
      errors.push(`Prompt is too short: ${length} characters (minimum: ${minLength})`);
      action = 'block';
    }

    // Check maximum length
    if (length > maxLength) {
      errors.push(`Prompt is too long: ${length} characters (maximum: ${maxLength})`);
      action = 'block';
    }

    // Check token limits
    if (tokenEstimate < minTokens) {
      errors.push(`Prompt token estimate too low: ~${tokenEstimate} tokens (minimum: ${minTokens})`);
      action = 'block';
    }

    if (tokenEstimate > maxTokens) {
      errors.push(`Prompt token estimate too high: ~${tokenEstimate} tokens (maximum: ${maxTokens})`);
      action = 'block';
    }

    // Warning thresholds
    const lengthPercentage = length / maxLength;
    const tokenPercentage = tokenEstimate / maxTokens;

    if (lengthPercentage >= warnThreshold && lengthPercentage < 1.0) {
      warnings.push(`Prompt is ${(lengthPercentage * 100).toFixed(1)}% of maximum length`);
      if (action === 'allow') {
        action = 'warn';
      }
    }

    if (tokenPercentage >= warnThreshold && tokenPercentage < 1.0) {
      warnings.push(`Prompt token estimate is ${(tokenPercentage * 100).toFixed(1)}% of maximum tokens`);
      if (action === 'allow') {
        action = 'warn';
      }
    }

    // Model recommendations based on length
    if (tokenEstimate > 0) {
      if (tokenEstimate <= 4000) {
        // Short prompts: use cheaper models
        if (provider === 'openai') {
          recommendedModel = model && model.includes('gpt-4') ? 'gpt-3.5-turbo' : model || 'gpt-3.5-turbo';
        } else if (provider === 'anthropic') {
          recommendedModel = model && model.includes('opus') ? 'claude-3-haiku' : model || 'claude-3-haiku';
        }
      } else if (tokenEstimate <= 16000) {
        // Medium prompts: use mid-tier models
        if (provider === 'openai') {
          recommendedModel = model || 'gpt-3.5-turbo-16k';
        } else if (provider === 'anthropic') {
          recommendedModel = model || 'claude-3-sonnet';
        }
      } else if (tokenEstimate <= 128000) {
        // Long prompts: use high-capacity models
        if (provider === 'openai') {
          recommendedModel = model || 'gpt-4-turbo';
        } else if (provider === 'anthropic') {
          recommendedModel = model || 'claude-3-opus';
        }
      } else {
        // Very long prompts: may need chunking or special handling
        warnings.push(`Prompt is very long (${tokenEstimate} tokens). Consider chunking or using a model with larger context window.`);
        if (provider === 'openai') {
          recommendedModel = 'gpt-4-turbo'; // Largest context window
        } else if (provider === 'anthropic') {
          recommendedModel = 'claude-3-opus';
        }
      }
    }

    return {
      valid: errors.length === 0,
      length,
      tokenEstimate,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
      recommendedModel,
      action,
    };
  }

  /**
   * Determine region-based routing for LLM requests
   * 
   * Routes requests based on:
   * - User/organization region preference
   * - Data residency requirements (GDPR, HIPAA, etc.)
   * - Compliance requirements
   * - Latency optimization
   * 
   * @param options - Routing configuration options
   * @returns Region routing recommendation
   */
  determineRegionRouting(options: {
    userId?: string;
    organizationId?: string;
    workspaceId?: string;
    userRegion?: string; // User's geographic region
    dataResidency?: string; // Required data residency (e.g., 'EU', 'US', 'global')
    complianceRequirements?: string[]; // Compliance requirements (e.g., 'GDPR', 'HIPAA', 'SOC2')
    preferredRegion?: string; // User's preferred region
    provider?: 'openai' | 'anthropic' | 'google';
  } = {}): RegionRoutingResult {
    const {
      userRegion,
      dataResidency,
      complianceRequirements = [],
      preferredRegion,
      provider = 'openai',
    } = options;

    // Default region mapping for providers
    const providerRegions: Record<string, Record<string, string>> = {
      openai: {
        'us': 'us-east',
        'eu': 'eu-west',
        'asia': 'asia-pacific',
        'global': 'us-east', // Default
      },
      anthropic: {
        'us': 'us-east',
        'eu': 'eu-west',
        'asia': 'asia-pacific',
        'global': 'us-east',
      },
      google: {
        'us': 'us-central',
        'eu': 'europe-west',
        'asia': 'asia-east',
        'global': 'us-central',
      },
    };

    // Determine target region based on priority:
    // 1. Data residency requirements (highest priority)
    // 2. Compliance requirements
    // 3. User preference
    // 4. User's geographic region
    // 5. Default (global/US)

    let targetRegion = 'us-east'; // Default
    let reason = 'Default routing';
    let requiresCompliance = false;

    // Check data residency requirements
    if (dataResidency) {
      requiresCompliance = true;
      if (dataResidency.toUpperCase() === 'EU' || dataResidency.toUpperCase() === 'EUROPE') {
        targetRegion = providerRegions[provider]?.['eu'] || 'eu-west';
        reason = `Data residency requirement: EU data must be processed in EU region`;
      } else if (dataResidency.toUpperCase() === 'US' || dataResidency.toUpperCase() === 'USA') {
        targetRegion = providerRegions[provider]?.['us'] || 'us-east';
        reason = `Data residency requirement: US data must be processed in US region`;
      } else if (dataResidency.toUpperCase() === 'ASIA' || dataResidency.toUpperCase() === 'ASIA-PACIFIC') {
        targetRegion = providerRegions[provider]?.['asia'] || 'asia-pacific';
        reason = `Data residency requirement: Asia data must be processed in Asia region`;
      }
    }

    // Check compliance requirements
    if (complianceRequirements.length > 0) {
      requiresCompliance = true;
      const hasGDPR = complianceRequirements.some(r => r.toUpperCase().includes('GDPR'));
      const hasHIPAA = complianceRequirements.some(r => r.toUpperCase().includes('HIPAA'));
      const hasSOC2 = complianceRequirements.some(r => r.toUpperCase().includes('SOC2'));

      if (hasGDPR && !dataResidency) {
        // GDPR requires EU data processing
        targetRegion = providerRegions[provider]?.['eu'] || 'eu-west';
        reason = `GDPR compliance: routing to EU region for data protection`;
      } else if (hasHIPAA && !dataResidency) {
        // HIPAA typically requires US-based processing
        targetRegion = providerRegions[provider]?.['us'] || 'us-east';
        reason = `HIPAA compliance: routing to US region for healthcare data`;
      } else if (hasSOC2 && !dataResidency) {
        // SOC2 can work with any region, but prefer US for consistency
        if (targetRegion === 'us-east') {
          reason = `SOC2 compliance: routing to US region`;
        }
      }
    }

    // Use preferred region if no compliance requirements
    if (!requiresCompliance && preferredRegion) {
      targetRegion = preferredRegion;
      reason = `User preferred region: ${preferredRegion}`;
    }

    // Use user's geographic region if no other preference
    if (!requiresCompliance && !preferredRegion && userRegion) {
      // Map user region to provider region
      const regionMap: Record<string, string> = {
        'us': providerRegions[provider]?.['us'] || 'us-east',
        'eu': providerRegions[provider]?.['eu'] || 'eu-west',
        'europe': providerRegions[provider]?.['eu'] || 'eu-west',
        'uk': providerRegions[provider]?.['eu'] || 'eu-west',
        'asia': providerRegions[provider]?.['asia'] || 'asia-pacific',
        'apac': providerRegions[provider]?.['asia'] || 'asia-pacific',
        'asia-pacific': providerRegions[provider]?.['asia'] || 'asia-pacific',
      };

      const mappedRegion = regionMap[userRegion.toLowerCase()];
      if (mappedRegion) {
        targetRegion = mappedRegion;
        reason = `User geographic region: ${userRegion} → ${targetRegion}`;
      }
    }

    // Build endpoint URL based on region and provider
    let endpoint: string | undefined;
    if (provider === 'openai') {
      // OpenAI doesn't expose regional endpoints directly, but we can note the region
      endpoint = `https://api.openai.com/v1`; // OpenAI uses global endpoint with regional routing
    } else if (provider === 'anthropic') {
      endpoint = `https://api.anthropic.com/v1`; // Anthropic uses global endpoint
    } else if (provider === 'google') {
      // Google Cloud has regional endpoints
      const googleRegions: Record<string, string> = {
        'us-central': 'us-central1',
        'europe-west': 'europe-west1',
        'asia-east': 'asia-east1',
      };
      const googleRegion = googleRegions[targetRegion] || 'us-central1';
      endpoint = `https://${googleRegion}-aiplatform.googleapis.com/v1`;
    }

    return {
      region: targetRegion,
      endpoint,
      reason,
      requiresCompliance,
      dataResidency: dataResidency || (requiresCompliance ? 'region-specific' : undefined),
    };
  }

  /**
   * Check for abuse
   */
  checkAbuse(input: string): AbuseCheckResult {
    // Check known abuse patterns
    for (const pattern of this.knownAbusePatterns) {
      if (pattern.test(input)) {
        return {
          isAbuse: true,
          abuseType: 'pattern_match',
          confidence: 0.8,
          action: 'block',
        };
      }
    }

    // Check for rapid repeated requests (would need rate limiting context)
    // This is a placeholder - in production, check against rate limit store

    // Check for suspicious content
    const safetyCheck = this.checkContentSafety(input);
    if (!safetyCheck.safe) {
      const hasCritical = safetyCheck.violations?.some(v => v.severity === 'critical');
      return {
        isAbuse: hasCritical || false,
        abuseType: 'content_safety',
        confidence: 1 - (safetyCheck.score || 0),
        action: hasCritical ? 'block' : 'warn',
      };
    }

    return {
      isAbuse: false,
      confidence: 0,
      action: 'allow',
    };
  }

  /**
   * Detect potential code injection
   */
  private detectCodeInjection(content: string): boolean {
    const codePatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /shell_exec\s*\(/i,
      /\$\{.*\}/, // Template injection
      /`.*\$\{.*\}`/, // Template literals
    ];

    return codePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Create input schema for agent queries
   */
  createInputSchema() {
    return z.object({
      query: z.string().min(1).max(10000),
      context: z.record(z.unknown()).optional(),
      config: z.record(z.unknown()).optional(),
    });
  }

  /**
   * Create output schema for agent responses
   */
  createOutputSchema() {
    return z.object({
      output: z.string(),
      intermediateSteps: z.array(z.any()).optional(),
      memory: z.any().optional(),
      executionTime: z.number().optional(),
      tokensUsed: z.number().optional(),
      cost: z.number().optional(),
    });
  }
}

export const guardrailsService = new GuardrailsService();

