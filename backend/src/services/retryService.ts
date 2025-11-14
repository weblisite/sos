/**
 * Retry Service
 * 
 * Provides retry logic with StackStorm integration for advanced recovery workflows.
 * Falls back to simple exponential backoff if StackStorm is not available.
 */

import { stackstormWorkflowService } from './stackstormWorkflowService';
import { stackstormConfig } from '../config/stackstorm';
import { featureFlagService } from './featureFlagService';

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  useStackStorm?: boolean;
  userId?: string;
  workspaceId?: string;
  fallbackModels?: string[];
  fallbackRegions?: string[];
  fallbackProviders?: string[];
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
  executionId?: string; // StackStorm execution ID if used
}

/**
 * Retry Service
 */
export class RetryService {
  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      useStackStorm = false,
      userId,
      workspaceId,
    } = options;

    // Check if StackStorm should be used
    const shouldUseStackStorm = useStackStorm && stackstormConfig.enabled;
    
    if (shouldUseStackStorm) {
      try {
        const isAvailable = await stackstormWorkflowService.isAvailable();
        if (isAvailable) {
          return await this.executeWithStackStorm(fn, options);
        }
      } catch (error: any) {
        console.warn('[Retry Service] StackStorm not available, falling back to simple retry:', error.message);
      }
    }

    // Fallback to simple exponential backoff
    return await this.executeWithSimpleRetry(fn, {
      maxRetries,
      initialDelay,
      maxDelay,
      backoffMultiplier,
    });
  }

  /**
   * Execute with StackStorm retry workflow
   */
  private async executeWithStackStorm<T>(
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<RetryResult<T>> {
    const {
      maxRetries = 3,
      fallbackModels = [],
      userId,
      workspaceId,
    } = options;

    // First attempt
    let lastError: any;
    let attempts = 0;

    try {
      attempts++;
      const result = await fn();
      return {
        success: true,
        result,
        attempts,
      };
    } catch (error: any) {
      lastError = error;
      
      // Determine failure reason
      const failureReason = this.determineFailureReason(error);
      
      // Check if we should use StackStorm for retry
      const enableStackStormRetry = await featureFlagService.isEnabled(
        'enable_stackstorm_retry',
        userId,
        workspaceId
      );

      if (!enableStackStormRetry || attempts >= maxRetries) {
        return {
          success: false,
          error: lastError,
          attempts,
        };
      }

      // Use StackStorm LLM retry workflow
      try {
        // Extract request details from error or context
        const originalRequest = this.extractRequestFromError(error) || {
          prompt: '',
          model: 'gpt-3.5-turbo',
        };

        const retryResult = await stackstormWorkflowService.executeLLMRetry({
          original_request: originalRequest,
          failure_reason: failureReason,
          max_retries: maxRetries - attempts,
          fallback_models: fallbackModels,
        });

        if (retryResult.success && retryResult.result) {
          return {
            success: true,
            result: retryResult.result as T,
            attempts: attempts + (retryResult.result.attempts || 1),
            executionId: retryResult.executionId,
          };
        } else {
          return {
            success: false,
            error: retryResult.result?.error || lastError,
            attempts: attempts + (retryResult.result?.attempts || 1),
            executionId: retryResult.executionId,
          };
        }
      } catch (stackstormError: any) {
        console.error('[Retry Service] StackStorm retry failed:', stackstormError);
        // Fall back to simple retry
        return await this.executeWithSimpleRetry(fn, {
          maxRetries: maxRetries - attempts,
          initialDelay: options.initialDelay || 1000,
          maxDelay: options.maxDelay || 30000,
          backoffMultiplier: options.backoffMultiplier || 2,
        });
      }
    }
  }

  /**
   * Execute with simple exponential backoff retry
   */
  private async executeWithSimpleRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries: number;
      initialDelay: number;
      maxDelay: number;
      backoffMultiplier: number;
    }
  ): Promise<RetryResult<T>> {
    const { maxRetries, initialDelay, maxDelay, backoffMultiplier } = options;
    let delay = initialDelay;
    let lastError: any;
    let attempts = 0;

    for (let i = 0; i < maxRetries; i++) {
      attempts++;
      try {
        const result = await fn();
        return {
          success: true,
          result,
          attempts,
        };
      } catch (error: any) {
        lastError = error;

        // Don't retry on certain error types
        if (this.shouldNotRetry(error)) {
          break;
        }

        // Wait before retrying (except on last attempt)
        if (i < maxRetries - 1) {
          await this.sleep(Math.min(delay, maxDelay));
          delay *= backoffMultiplier;
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
    };
  }

  /**
   * Determine failure reason from error
   */
  private determineFailureReason(error: any): string {
    if (error.code === 'RATE_LIMIT_EXCEEDED' || error.message?.includes('rate limit')) {
      return 'Rate limit exceeded';
    }
    if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
      return 'Request timeout';
    }
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('network')) {
      return 'Network error';
    }
    if (error.code === 'AUTHENTICATION_ERROR' || error.message?.includes('auth')) {
      return 'Authentication error';
    }
    if (error.code === 'QUOTA_EXCEEDED' || error.message?.includes('quota')) {
      return 'Quota exceeded';
    }
    return error.message || 'Unknown error';
  }

  /**
   * Extract request details from error
   */
  private extractRequestFromError(error: any): { prompt: string; model: string; parameters?: any } | null {
    // Try to extract from error context
    if (error.request) {
      return {
        prompt: error.request.prompt || '',
        model: error.request.model || 'gpt-3.5-turbo',
        parameters: error.request.parameters,
      };
    }
    return null;
  }

  /**
   * Check if error should not be retried
   */
  private shouldNotRetry(error: any): boolean {
    // Don't retry on authentication errors (won't succeed on retry)
    if (error.code === 'AUTHENTICATION_ERROR' || error.code === 'UNAUTHORIZED') {
      return true;
    }
    // Don't retry on validation errors (won't succeed on retry)
    if (error.code === 'VALIDATION_ERROR' || error.code === 'INVALID_INPUT') {
      return true;
    }
    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry with reroute (for routing failures)
   */
  async retryWithReroute<T>(
    fn: (region?: string, provider?: string) => Promise<T>,
    options: RetryOptions & {
      originalRegion?: string;
      originalProvider?: string;
    }
  ): Promise<RetryResult<T>> {
    const {
      maxRetries = 3,
      fallbackRegions = [],
      fallbackProviders = [],
      originalRegion,
      originalProvider,
      useStackStorm = false,
      userId,
      workspaceId,
    } = options;

    // Check if StackStorm should be used
    const shouldUseStackStorm = useStackStorm && stackstormConfig.enabled;
    
    if (shouldUseStackStorm) {
      try {
        const isAvailable = await stackstormWorkflowService.isAvailable();
        if (isAvailable) {
          return await this.retryWithStackStormReroute(fn, options);
        }
      } catch (error: any) {
        console.warn('[Retry Service] StackStorm not available, falling back to simple reroute:', error.message);
      }
    }

    // Fallback to simple reroute
    return await this.retryWithSimpleReroute(fn, {
      maxRetries,
      fallbackRegions,
      fallbackProviders,
      originalRegion,
      originalProvider,
    });
  }

  /**
   * Retry with StackStorm reroute workflow
   */
  private async retryWithStackStormReroute<T>(
    fn: (region?: string, provider?: string) => Promise<T>,
    options: RetryOptions & {
      originalRegion?: string;
      originalProvider?: string;
    }
  ): Promise<RetryResult<T>> {
    const {
      fallbackRegions = [],
      fallbackProviders = [],
      originalRegion,
      originalProvider,
    } = options;

    let lastError: any;
    let attempts = 0;

    try {
      attempts++;
      const result = await fn(originalRegion, originalProvider);
      return {
        success: true,
        result,
        attempts,
      };
    } catch (error: any) {
      lastError = error;

      try {
        const rerouteResult = await stackstormWorkflowService.executeReroute({
          original_request: {
            region: originalRegion,
            provider: originalProvider,
          },
          failure_reason: this.determineFailureReason(error),
          fallback_regions: fallbackRegions,
          fallback_providers: fallbackProviders,
        });

        if (rerouteResult.success && rerouteResult.result) {
          // Execute with new region/provider
          const newRegion = rerouteResult.result.final_region || originalRegion;
          const newProvider = rerouteResult.result.final_provider || originalProvider;

          try {
            const result = await fn(newRegion, newProvider);
            return {
              success: true,
              result,
              attempts: attempts + 1,
              executionId: rerouteResult.executionId,
            };
          } catch (retryError: any) {
            return {
              success: false,
              error: retryError,
              attempts: attempts + 1,
              executionId: rerouteResult.executionId,
            };
          }
        } else {
          return {
            success: false,
            error: rerouteResult.result?.error || lastError,
            attempts: attempts + 1,
            executionId: rerouteResult.executionId,
          };
        }
      } catch (stackstormError: any) {
        console.error('[Retry Service] StackStorm reroute failed:', stackstormError);
        return {
          success: false,
          error: lastError,
          attempts,
        };
      }
    }
  }

  /**
   * Retry with simple reroute (fallback)
   */
  private async retryWithSimpleReroute<T>(
    fn: (region?: string, provider?: string) => Promise<T>,
    options: {
      maxRetries: number;
      fallbackRegions: string[];
      fallbackProviders: string[];
      originalRegion?: string;
      originalProvider?: string;
    }
  ): Promise<RetryResult<T>> {
    const { maxRetries, fallbackRegions, fallbackProviders, originalRegion, originalProvider } = options;
    let lastError: any;
    let attempts = 0;

    // Try original first
    try {
      attempts++;
      const result = await fn(originalRegion, originalProvider);
      return {
        success: true,
        result,
        attempts,
      };
    } catch (error: any) {
      lastError = error;
    }

    // Try fallback regions
    for (const region of fallbackRegions) {
      if (attempts >= maxRetries) break;
      try {
        attempts++;
        const result = await fn(region, originalProvider);
        return {
          success: true,
          result,
          attempts,
        };
      } catch (error: any) {
        lastError = error;
      }
    }

    // Try fallback providers
    for (const provider of fallbackProviders) {
      if (attempts >= maxRetries) break;
      try {
        attempts++;
        const result = await fn(originalRegion, provider);
        return {
          success: true,
          result,
          attempts,
        };
      } catch (error: any) {
        lastError = error;
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
    };
  }
}

// Singleton instance
export const retryService = new RetryService();

