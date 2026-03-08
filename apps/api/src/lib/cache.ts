import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

// =============================================================================
// Redis Client
// =============================================================================

let redisClient: Redis | null = null;
let isConnected = false;

export function getRedisClient(): Redis | null {
  if (!redisClient && config.redis.url) {
    try {
      redisClient = new Redis(config.redis.url, {
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn('Redis connection failed after 3 retries');
            return null; // Stop retrying
          }
          return Math.min(times * 200, 2000);
        },
      });

      redisClient.on('connect', () => {
        isConnected = true;
        logger.info('Redis connected');
      });

      redisClient.on('error', (err) => {
        isConnected = false;
        logger.error({ err }, 'Redis client error');
      });

      redisClient.on('close', () => {
        isConnected = false;
        logger.info('Redis connection closed');
      });

      // Connect immediately
      redisClient.connect().catch((err) => {
        logger.warn({ err }, 'Redis initial connection failed');
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to create Redis client');
    }
  }
  return redisClient;
}

export function isRedisConnected(): boolean {
  return isConnected;
}

// =============================================================================
// Cache Key Prefixes
// =============================================================================

export const CacheKeys = {
  package: (id: string) => `pkg:${id}`,
  packageVersion: (id: string, version: string) => `pkg:${id}:v:${version}`,
  packageVersions: (id: string) => `pkg:${id}:versions`,
  packageDownloads: (id: string) => `pkg:${id}:downloads`,
  search: (query: string, options: string) => `search:${query}:${options}`,
  searchSuggest: (prefix: string) => `suggest:${prefix}`,
  user: (id: string) => `user:${id}`,
  userPackages: (id: string) => `user:${id}:packages`,
  categories: () => 'categories',
  featuredPackages: () => 'featured',
  popularPackages: () => 'popular',
  recentPackages: () => 'recent',
} as const;

// =============================================================================
// Cache TTLs (in seconds)
// =============================================================================

export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 3600,          // 1 hour
  VERY_LONG: 86400,    // 24 hours
  PACKAGE: 300,        // 5 minutes
  SEARCH: 60,          // 1 minute
  USER: 300,           // 5 minutes
  CATEGORIES: 3600,    // 1 hour
  FEATURED: 300,       // 5 minutes
} as const;

// =============================================================================
// Cache Operations
// =============================================================================

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client || !isConnected) return null;

  try {
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.debug({ error, key }, 'Cache get error');
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = CacheTTL.MEDIUM
): Promise<void> {
  const client = getRedisClient();
  if (!client || !isConnected) return;

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.debug({ error, key }, 'Cache set error');
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient();
  if (!client || !isConnected) return;

  try {
    await client.del(key);
  } catch (error) {
    logger.debug({ error, key }, 'Cache delete error');
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  if (!client || !isConnected) return;

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    logger.debug({ error, pattern }, 'Cache delete pattern error');
  }
}

// =============================================================================
// Cache-Aside Pattern
// =============================================================================

export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = CacheTTL.MEDIUM
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch from source
  const value = await fetcher();

  // Store in cache (don't await to not block)
  cacheSet(key, value, ttlSeconds).catch(() => {
    // Ignore cache errors
  });

  return value;
}

// =============================================================================
// Counter Operations (for analytics)
// =============================================================================

export async function incrementCounter(
  key: string,
  amount: number = 1
): Promise<number> {
  const client = getRedisClient();
  if (!client || !isConnected) return 0;

  try {
    return await client.incrby(key, amount);
  } catch (error) {
    logger.debug({ error, key }, 'Counter increment error');
    return 0;
  }
}

export async function getCounter(key: string): Promise<number> {
  const client = getRedisClient();
  if (!client || !isConnected) return 0;

  try {
    const value = await client.get(key);
    return parseInt(value || '0', 10);
  } catch (error) {
    logger.debug({ error, key }, 'Counter get error');
    return 0;
  }
}

// =============================================================================
// Sorted Set Operations (for leaderboards/rankings)
// =============================================================================

export async function addToSortedSet(
  key: string,
  score: number,
  member: string
): Promise<void> {
  const client = getRedisClient();
  if (!client || !isConnected) return;

  try {
    await client.zadd(key, score, member);
  } catch (error) {
    logger.debug({ error, key }, 'Sorted set add error');
  }
}

export async function getTopFromSortedSet(
  key: string,
  count: number = 10
): Promise<string[]> {
  const client = getRedisClient();
  if (!client || !isConnected) return [];

  try {
    return await client.zrevrange(key, 0, count - 1);
  } catch (error) {
    logger.debug({ error, key }, 'Sorted set get error');
    return [];
  }
}

// =============================================================================
// Cache Invalidation Helpers
// =============================================================================

export async function invalidatePackageCache(packageId: string): Promise<void> {
  await Promise.all([
    cacheDelete(CacheKeys.package(packageId)),
    cacheDeletePattern(CacheKeys.packageVersion(packageId, '*')),
    cacheDelete(CacheKeys.packageVersions(packageId)),
    cacheDelete(CacheKeys.featuredPackages()),
    cacheDelete(CacheKeys.popularPackages()),
    cacheDelete(CacheKeys.recentPackages()),
  ]);
}

export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    cacheDelete(CacheKeys.user(userId)),
    cacheDelete(CacheKeys.userPackages(userId)),
  ]);
}

export async function invalidateSearchCache(): Promise<void> {
  await cacheDeletePattern('search:*');
  await cacheDeletePattern('suggest:*');
}

// =============================================================================
// Health Check
// =============================================================================

export async function checkRedisHealth(): Promise<{
  status: 'ok' | 'error' | 'disconnected';
  latencyMs?: number;
}> {
  const client = getRedisClient();
  if (!client || !isConnected) {
    return { status: 'disconnected' };
  }

  try {
    const start = Date.now();
    await client.ping();
    const latencyMs = Date.now() - start;
    return { status: 'ok', latencyMs };
  } catch (error) {
    return { status: 'error' };
  }
}
