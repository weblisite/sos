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

