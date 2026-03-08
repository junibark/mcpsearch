import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { ApiError } from './api-error.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

// =============================================================================
// Types
// =============================================================================

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response, next: NextFunction) => void;
}

interface RateLimitInfo {
  remaining: number;
  reset: number;
  total: number;
}

// =============================================================================
// Redis Client
// =============================================================================

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!redisClient && config.redis.url) {
    try {
      redisClient = new Redis(config.redis.url, {
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      redisClient.on('error', (err) => {
        logger.error({ err }, 'Redis client error');
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to create Redis client, using in-memory fallback');
    }
  }
  return redisClient;
}

// =============================================================================
// In-Memory Fallback Store
// =============================================================================

const memoryStore = new Map<string, { count: number; resetTime: number }>();

function cleanupMemoryStore(): void {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}

// Cleanup every minute
setInterval(cleanupMemoryStore, 60000);

// =============================================================================
// Rate Limit Implementation
// =============================================================================

async function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<RateLimitInfo> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetTime = now + windowMs;

  if (redis) {
    try {
      // Use Redis sorted set for sliding window
      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zadd(key, now, `${now}-${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, Math.ceil(windowMs / 1000));

      const results = await multi.exec();
      const count = (results?.[2]?.[1] as number) || 0;

      return {
        remaining: Math.max(0, maxRequests - count),
        reset: resetTime,
        total: maxRequests,
      };
    } catch (error) {
      logger.warn({ error }, 'Redis rate limit check failed, using memory fallback');
    }
  }

  // In-memory fallback
  const stored = memoryStore.get(key);

  if (!stored || stored.resetTime < now) {
    memoryStore.set(key, { count: 1, resetTime });
    return {
      remaining: maxRequests - 1,
      reset: resetTime,
      total: maxRequests,
    };
  }

  stored.count += 1;
  return {
    remaining: Math.max(0, maxRequests - stored.count),
    reset: stored.resetTime,
    total: maxRequests,
  };
}

// =============================================================================
// Rate Limit Middleware Factory
// =============================================================================

export function rateLimit(options: Partial<RateLimitOptions> = {}) {
  const {
    windowMs = config.rateLimit.windowMs,
    maxRequests = config.rateLimit.maxRequests,
    keyPrefix = 'rl:',
    keyGenerator = defaultKeyGenerator,
    skip,
    handler = defaultHandler,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if configured to skip
    if (skip?.(req)) {
      next();
      return;
    }

    try {
      const key = keyPrefix + keyGenerator(req);
      const info = await checkRateLimit(key, windowMs, maxRequests);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', info.total);
      res.setHeader('X-RateLimit-Remaining', info.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.reset / 1000));

      if (info.remaining <= 0) {
        res.setHeader('Retry-After', Math.ceil((info.reset - Date.now()) / 1000));
        handler(req, res, next);
        return;
      }

      next();
    } catch (error) {
      // On error, allow the request through but log it
      logger.error({ error }, 'Rate limit middleware error');
      next();
    }
  };
}

// =============================================================================
// Default Key Generator
// =============================================================================

function defaultKeyGenerator(req: Request): string {
  // Use authenticated user ID if available
  if (req.user?.userId) {
    return `user:${req.user.userId}`;
  }

  // Otherwise use IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket.remoteAddress || 'unknown';

  return `ip:${ip}`;
}

// =============================================================================
// Default Handler
// =============================================================================

function defaultHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.tooManyRequests('Rate limit exceeded. Please try again later.'));
}

// =============================================================================
// Pre-configured Rate Limiters
// =============================================================================

// Standard API rate limit
export const apiRateLimit = rateLimit();

// Stricter limit for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  keyPrefix: 'rl:auth:',
});

// Stricter limit for search to prevent abuse
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  keyPrefix: 'rl:search:',
});

// Very strict limit for package publishing
export const publishRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  keyPrefix: 'rl:publish:',
  keyGenerator: (req) => `user:${req.user?.userId || 'anon'}`,
});

// Limit for download endpoints
export const downloadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyPrefix: 'rl:download:',
});
