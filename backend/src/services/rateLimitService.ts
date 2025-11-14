/**
 * Rate Limiting Service
 * 
 * Provides per-user rate limiting for abuse prevention.
 * Uses Redis for distributed rate limiting across multiple instances.
 * 
 * Features:
 * - Per-user rate limiting
 * - Per-organization rate limiting
 * - Per-workspace rate limiting
 * - Sliding window algorithm
 * - Configurable limits and windows
 * - Integration with abuse detection
 */

import Redis from 'ioredis';
import { createId } from '@paralleldrive/cuid2';
import { redis as sharedRedis } from '../config/redis';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix?: string; // Redis key prefix
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number; // Remaining requests in current window
  resetAt: Date; // When the rate limit resets
  limit: number; // Total limit
  retryAfter?: number; // Seconds to wait before retry (if rate limited)
}

/**
 * Rate limit check options
 */
export interface RateLimitOptions {
  userId?: string;
  organizationId?: string;
  workspaceId?: string;
  endpoint?: string; // Specific endpoint being rate limited
  identifier?: string; // Custom identifier (e.g., IP address)
}

/**
 * Default rate limit configurations
 */
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Per-user limits
  user: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    keyPrefix: 'rl:user',
  },
  
  // Per-organization limits
  organization: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000, // 1000 requests per minute
    keyPrefix: 'rl:org',
  },
  
  // Per-workspace limits
  workspace: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 500, // 500 requests per minute
    keyPrefix: 'rl:workspace',
  },
  
  // LLM-specific limits (stricter)
  llm: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 LLM requests per minute per user
    keyPrefix: 'rl:llm',
  },
  
  // Agent-specific limits
  agent: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 agent executions per minute per user
    keyPrefix: 'rl:agent',
  },
  
  // Abuse prevention limits (very strict)
  abuse: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute for abuse prevention
    keyPrefix: 'rl:abuse',
  },
};

/**
 * Rate Limiting Service
 */
export class RateLimitService {
  private redis: Redis | null = null;
  private enabled: boolean = false;
  private inMemoryStore: Map<string, { count: number; resetAt: number }> = new Map();

  constructor() {
    // Use shared Redis connection if available
    try {
      // Check if shared Redis is available and connected
      if (sharedRedis && sharedRedis.status === 'ready') {
        this.redis = sharedRedis;
        this.enabled = true;
        console.log('✅ Rate limiting service initialized with shared Redis');
      } else {
        // Try to use shared Redis anyway (it might connect later)
        this.redis = sharedRedis;
        this.enabled = !!process.env.REDIS_URL;
        
        if (this.enabled) {
          console.log('✅ Rate limiting service initialized with shared Redis (connecting...)');
        } else {
          console.log('⚠️ Rate limiting using in-memory store (REDIS_URL not set)');
        }
      }
    } catch (error: any) {
      console.warn('[RateLimit] Failed to use shared Redis, using in-memory store:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Check rate limit for a user/organization/workspace
   */
  async checkRateLimit(
    type: keyof typeof DEFAULT_RATE_LIMITS | RateLimitConfig,
    options: RateLimitOptions = {}
  ): Promise<RateLimitResult> {
    const config = typeof type === 'string' ? DEFAULT_RATE_LIMITS[type] : type;
    if (!config) {
      // No limit configured, allow
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(Date.now() + config.windowMs),
        limit: Infinity,
      };
    }

    const key = this.buildKey(config.keyPrefix || 'rl', type, options);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    if (this.redis && this.enabled) {
      return this.checkRateLimitRedis(key, config, now, windowStart);
    } else {
      return this.checkRateLimitMemory(key, config, now, windowStart);
    }
  }

  /**
   * Check rate limit using Redis (sliding window)
   */
  private async checkRateLimitRedis(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number
  ): Promise<RateLimitResult> {
    if (!this.redis) {
      return this.checkRateLimitMemory(key, config, now, windowStart);
    }

    try {
      // Use sorted set for sliding window
      const pipeline = this.redis.pipeline();
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests in window
      pipeline.zcard(key);
      
      // Add current request
      pipeline.zadd(key, now, `${now}-${createId()}`);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));
      
      // Get count after adding
      pipeline.zcard(key);
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      const countBefore = results[1]?.[1] as number || 0;
      const countAfter = results[4]?.[1] as number || 0;
      
      const allowed = countBefore < config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - countAfter);
      const resetAt = new Date(now + config.windowMs);
      
      if (!allowed) {
        // Calculate retry after
        const oldestEntry = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
        if (oldestEntry && oldestEntry.length >= 2) {
          const oldestTimestamp = parseInt(oldestEntry[1]);
          const retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);
          return {
            allowed: false,
            remaining: 0,
            resetAt,
            limit: config.maxRequests,
            retryAfter: Math.max(0, retryAfter),
          };
        }
      }

      return {
        allowed,
        remaining,
        resetAt,
        limit: config.maxRequests,
      };
    } catch (error: any) {
      console.warn('[RateLimit] Redis check failed, falling back to memory:', error);
      return this.checkRateLimitMemory(key, config, now, windowStart);
    }
  }

  /**
   * Check rate limit using in-memory store (fallback)
   */
  private checkRateLimitMemory(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number
  ): RateLimitResult {
    const limiter = this.inMemoryStore.get(key);
    
    if (!limiter || limiter.resetAt < now) {
      // Create new limiter or reset expired one
      const newLimiter = {
        count: 1,
        resetAt: now + config.windowMs,
      };
      this.inMemoryStore.set(key, newLimiter);
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(newLimiter.resetAt),
        limit: config.maxRequests,
      };
    }

    // Check if within limit
    if (limiter.count >= config.maxRequests) {
      const retryAfter = Math.ceil((limiter.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(limiter.resetAt),
        limit: config.maxRequests,
        retryAfter: Math.max(0, retryAfter),
      };
    }

    // Increment count
    limiter.count++;
    this.inMemoryStore.set(key, limiter);

    return {
      allowed: true,
      remaining: config.maxRequests - limiter.count,
      resetAt: new Date(limiter.resetAt),
      limit: config.maxRequests,
    };
  }

  /**
   * Build Redis key for rate limiting
   */
  private buildKey(
    prefix: string,
    type: string | RateLimitConfig,
    options: RateLimitOptions
  ): string {
    const parts: string[] = [prefix];
    
    if (typeof type === 'string') {
      parts.push(type);
    }
    
    if (options.endpoint) {
      parts.push(options.endpoint);
    }
    
    if (options.userId) {
      parts.push('user', options.userId);
    } else if (options.organizationId) {
      parts.push('org', options.organizationId);
    } else if (options.workspaceId) {
      parts.push('workspace', options.workspaceId);
    } else if (options.identifier) {
      parts.push('id', options.identifier);
    } else {
      parts.push('global');
    }

    return parts.join(':');
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(
    type: keyof typeof DEFAULT_RATE_LIMITS,
    options: RateLimitOptions = {}
  ): Promise<void> {
    const config = DEFAULT_RATE_LIMITS[type];
    if (!config) return;

    const key = this.buildKey(config.keyPrefix || 'rl', type, options);

    if (this.redis && this.enabled) {
      try {
        await this.redis.del(key);
      } catch (error: any) {
        console.warn('[RateLimit] Failed to reset rate limit in Redis:', error);
      }
    } else {
      this.inMemoryStore.delete(key);
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(
    type: keyof typeof DEFAULT_RATE_LIMITS,
    options: RateLimitOptions = {}
  ): Promise<RateLimitResult> {
    const config = DEFAULT_RATE_LIMITS[type];
    if (!config) {
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: new Date(Date.now() + config.windowMs),
        limit: Infinity,
      };
    }

    const key = this.buildKey(config.keyPrefix || 'rl', type, options);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    if (this.redis && this.enabled) {
      try {
        // Count current requests in window
        await this.redis.zremrangebyscore(key, 0, windowStart);
        const count = await this.redis.zcard(key);
        
        const ttl = await this.redis.ttl(key);
        const resetAt = ttl > 0 ? new Date(now + (ttl * 1000)) : new Date(now + config.windowMs);

        return {
          allowed: count < config.maxRequests,
          remaining: Math.max(0, config.maxRequests - count),
          resetAt,
          limit: config.maxRequests,
        };
      } catch (error: any) {
        console.warn('[RateLimit] Failed to get rate limit status from Redis:', error);
      }
    }

    // Fallback to memory
    const limiter = this.inMemoryStore.get(key);
    if (!limiter || limiter.resetAt < now) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowMs),
        limit: config.maxRequests,
      };
    }

    return {
      allowed: limiter.count < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - limiter.count),
      resetAt: new Date(limiter.resetAt),
      limit: config.maxRequests,
    };
  }

  /**
   * Clean up expired entries from in-memory store
   */
  private cleanupMemoryStore(): void {
    const now = Date.now();
    for (const [key, limiter] of this.inMemoryStore.entries()) {
      if (limiter.resetAt < now) {
        this.inMemoryStore.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup of in-memory store
   */
  startCleanup(): void {
    // Clean up every 5 minutes
    setInterval(() => {
      this.cleanupMemoryStore();
    }, 5 * 60 * 1000);
  }
}

// Singleton instance
export const rateLimitService = new RateLimitService();

// Start cleanup if using in-memory store
if (!process.env.REDIS_URL) {
  rateLimitService.startCleanup();
}

