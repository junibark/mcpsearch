/**
 * User Service
 *
 * Business logic for user operations.
 */

import type { User, ApiKey } from '@mcpsearch/shared';
import { userRepository } from '../repositories/user-repository.js';
import {
  cacheGet,
  cacheSet,
  cacheGetOrSet,
  CacheKeys,
  CacheTTL,
  invalidateUserCache,
} from '../lib/cache.js';
import { logger } from '../lib/logger.js';

// =============================================================================
// User Service
// =============================================================================

export class UserService {
  // ===========================================================================
  // Get Operations
  // ===========================================================================

  async getById(userId: string): Promise<User | null> {
    return cacheGetOrSet(
      CacheKeys.user(userId),
      () => userRepository.getById(userId),
      CacheTTL.USER
    );
  }

  async getByCognitoSub(cognitoSub: string): Promise<User | null> {
    // First check cache by cognito sub
    const cachedUserId = await cacheGet<string>(`cognito:${cognitoSub}`);
    if (cachedUserId) {
      return this.getById(cachedUserId);
    }

    const user = await userRepository.getByCognitoSub(cognitoSub);
    if (user) {
      // Cache the mapping
      await cacheSet(`cognito:${cognitoSub}`, user.userId, CacheTTL.LONG);
    }
    return user;
  }

  async getByUsername(username: string): Promise<User | null> {
    return userRepository.getByUsername(username);
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  async findOrCreate(input: {
    cognitoSub: string;
    username: string;
    email: string;
    displayName?: string;
    avatar?: string;
  }): Promise<User> {
    // Check if user already exists
    const existing = await this.getByCognitoSub(input.cognitoSub);
    if (existing) {
      return existing;
    }

    // Check username availability
    const usernameExists = await this.getByUsername(input.username);
    if (usernameExists) {
      throw new Error(`Username '${input.username}' is already taken`);
    }

    const user = await userRepository.create(input);

    // Cache the new user
    await cacheSet(CacheKeys.user(user.userId), user, CacheTTL.USER);
    await cacheSet(`cognito:${input.cognitoSub}`, user.userId, CacheTTL.LONG);

    logger.info({ userId: user.userId, username: input.username }, 'User created');
    return user;
  }

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  async update(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = await userRepository.update(userId, updates);
    if (user) {
      await invalidateUserCache(userId);
    }
    return user;
  }

  async updateProfile(
    userId: string,
    updates: {
      displayName?: string;
      avatar?: string;
      bio?: string;
      website?: string;
      twitter?: string;
      github?: string;
    }
  ): Promise<User | null> {
    return this.update(userId, updates);
  }

  // ===========================================================================
  // Publisher Status
  // ===========================================================================

  async applyForPublisher(userId: string): Promise<void> {
    const user = await this.getById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.publisherStatus === 'approved') {
      throw new Error('You are already a publisher');
    }

    if (user.publisherStatus === 'pending') {
      throw new Error('Your publisher application is pending');
    }

    await userRepository.updatePublisherStatus(userId, 'pending');
    await invalidateUserCache(userId);

    logger.info({ userId }, 'Publisher application submitted');
  }

  async approvePublisher(userId: string): Promise<void> {
    await userRepository.updatePublisherStatus(userId, 'approved');
    await invalidateUserCache(userId);

    logger.info({ userId }, 'Publisher approved');
  }

  async rejectPublisher(userId: string): Promise<void> {
    await userRepository.updatePublisherStatus(userId, 'none');
    await invalidateUserCache(userId);

    logger.info({ userId }, 'Publisher rejected');
  }

  // ===========================================================================
  // API Key Operations
  // ===========================================================================

  async createApiKey(
    userId: string,
    name: string,
    scopes: string[],
    expiresInDays?: number
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const user = await this.getById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check API key limit (e.g., max 10 keys per user)
    const existingKeys = await this.listApiKeys(userId);
    if (existingKeys.length >= 10) {
      throw new Error('Maximum API key limit reached (10 keys)');
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    return userRepository.createApiKey(userId, name, scopes, expiresAt);
  }

  async validateApiKey(rawKey: string): Promise<{ valid: boolean; user?: User }> {
    const result = await userRepository.validateApiKey(rawKey);

    if (!result.valid || !result.apiKey) {
      return { valid: false };
    }

    const user = await this.getById(result.apiKey.userId);
    if (!user) {
      return { valid: false };
    }

    return { valid: true, user };
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return userRepository.listApiKeys(userId);
  }

  async deleteApiKey(userId: string, keyId: string): Promise<void> {
    await userRepository.deleteApiKey(userId, keyId);
    logger.info({ userId, keyId }, 'API key deleted');
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  async incrementPackageCount(userId: string): Promise<void> {
    await userRepository.incrementPackageCount(userId);
    await invalidateUserCache(userId);
  }
}

// Export singleton
export const userService = new UserService();
