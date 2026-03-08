import type { User, ApiKey } from '@mcpsearch/shared';
import {
  getItem,
  putItem,
  updateItem,
  query,
  deleteItem,
  buildUpdateExpression,
} from '../lib/aws/dynamodb.js';
import { logger } from '../lib/logger.js';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';

// =============================================================================
// Key Helpers
// =============================================================================

function userKey(userId: string) {
  return {
    PK: `USER#${userId}`,
    SK: 'PROFILE',
  };
}

function cognitoUserKey(cognitoSub: string) {
  return {
    PK: `COGNITO#${cognitoSub}`,
    SK: 'USER',
  };
}

function apiKeyKey(keyId: string) {
  return {
    PK: `APIKEY#${keyId}`,
    SK: 'META',
  };
}

function userApiKeyKey(userId: string, keyId: string) {
  return {
    PK: `USER#${userId}`,
    SK: `APIKEY#${keyId}`,
  };
}

// =============================================================================
// Entity Types
// =============================================================================

interface UserEntity extends User {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

interface CognitoMapping {
  PK: string;
  SK: string;
  userId: string;
}

interface ApiKeyEntity extends ApiKey {
  PK: string;
  SK: string;
  keyHash: string;
}

// =============================================================================
// User Repository
// =============================================================================

export class UserRepository {
  // ===========================================================================
  // Get Operations
  // ===========================================================================

  async getById(userId: string): Promise<User | null> {
    const entity = await getItem<UserEntity>(userKey(userId));
    if (!entity) return null;
    return this.toUser(entity);
  }

  async getByCognitoSub(cognitoSub: string): Promise<User | null> {
    const mapping = await getItem<CognitoMapping>(cognitoUserKey(cognitoSub));
    if (!mapping) return null;
    return this.getById(mapping.userId);
  }

  async getByUsername(username: string): Promise<User | null> {
    const result = await query<UserEntity>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'USERS',
        ':sk': `USERNAME#${username.toLowerCase()}`,
      },
      Limit: 1,
    });

    if (result.items.length === 0) return null;
    return this.toUser(result.items[0]);
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  async create(input: {
    cognitoSub: string;
    username: string;
    email: string;
    displayName?: string;
    avatar?: string;
  }): Promise<User> {
    const now = new Date().toISOString();
    const userId = `user_${uuid().replace(/-/g, '')}`;

    const userEntity: UserEntity = {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      GSI1PK: 'USERS',
      GSI1SK: `USERNAME#${input.username.toLowerCase()}`,

      userId,
      cognitoSub: input.cognitoSub,
      username: input.username,
      email: input.email,
      displayName: input.displayName || input.username,
      avatar: input.avatar,
      publisherStatus: 'none',
      stats: {
        packagesPublished: 0,
        totalDownloads: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    const cognitoMapping: CognitoMapping = {
      PK: `COGNITO#${input.cognitoSub}`,
      SK: 'USER',
      userId,
    };

    // Create both user and cognito mapping
    await Promise.all([
      putItem({ Item: userEntity }),
      putItem({ Item: cognitoMapping }),
    ]);

    logger.info({ userId, username: input.username }, 'User created');
    return this.toUser(userEntity);
  }

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  async update(userId: string, updates: Partial<User>): Promise<User | null> {
    const now = new Date().toISOString();

    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
      buildUpdateExpression({
        ...updates,
        updatedAt: now,
      });

    const result = await updateItem({
      Key: userKey(userId),
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    if (!result) return null;
    return this.toUser(result as UserEntity);
  }

  async updatePublisherStatus(
    userId: string,
    status: 'none' | 'pending' | 'approved'
  ): Promise<void> {
    await updateItem({
      Key: userKey(userId),
      UpdateExpression: 'SET publisherStatus = :status, updatedAt = :now',
      ExpressionAttributeValues: {
        ':status': status,
        ':now': new Date().toISOString(),
      },
    });
  }

  async incrementPackageCount(userId: string): Promise<void> {
    await updateItem({
      Key: userKey(userId),
      UpdateExpression:
        'SET stats.packagesPublished = if_not_exists(stats.packagesPublished, :zero) + :one',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
      },
    });
  }

  // ===========================================================================
  // API Key Operations
  // ===========================================================================

  async createApiKey(
    userId: string,
    name: string,
    scopes: string[],
    expiresAt?: string
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const now = new Date().toISOString();
    const keyId = `key_${uuid().replace(/-/g, '')}`;

    // Generate a secure random key
    const rawKey = `mcp_${crypto.randomBytes(32).toString('base64url')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKeyEntity: ApiKeyEntity = {
      PK: `APIKEY#${keyId}`,
      SK: 'META',
      keyId,
      userId,
      name,
      keyHash,
      scopes,
      lastUsedAt: undefined,
      expiresAt,
      createdAt: now,
    };

    // Also store reference on user
    const userApiKeyRef = {
      PK: `USER#${userId}`,
      SK: `APIKEY#${keyId}`,
      keyId,
      name,
      createdAt: now,
    };

    await Promise.all([
      putItem({ Item: apiKeyEntity }),
      putItem({ Item: userApiKeyRef }),
    ]);

    logger.info({ userId, keyId, name }, 'API key created');

    return {
      apiKey: this.toApiKey(apiKeyEntity),
      rawKey,
    };
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
    // Query by key hash using GSI
    const result = await query<ApiKeyEntity>({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `KEYHASH#${keyHash}`,
      },
      Limit: 1,
    });

    if (result.items.length === 0) return null;
    return this.toApiKey(result.items[0]);
  }

  async validateApiKey(rawKey: string): Promise<{ valid: boolean; apiKey?: ApiKey }> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.getApiKeyByHash(keyHash);

    if (!apiKey) {
      return { valid: false };
    }

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { valid: false };
    }

    // Update last used
    await updateItem({
      Key: apiKeyKey(apiKey.keyId),
      UpdateExpression: 'SET lastUsedAt = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
      },
    });

    return { valid: true, apiKey };
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const result = await query<ApiKeyEntity>({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'APIKEY#',
      },
    });

    // Get full API key details
    const keyIds = result.items.map((item) => (item as unknown as { keyId: string }).keyId);
    const keys: ApiKey[] = [];

    for (const keyId of keyIds) {
      const entity = await getItem<ApiKeyEntity>(apiKeyKey(keyId));
      if (entity) {
        keys.push(this.toApiKey(entity));
      }
    }

    return keys;
  }

  async deleteApiKey(userId: string, keyId: string): Promise<void> {
    // Verify ownership
    const entity = await getItem<ApiKeyEntity>(apiKeyKey(keyId));
    if (!entity || entity.userId !== userId) {
      throw new Error('API key not found');
    }

    await Promise.all([
      deleteItem(apiKeyKey(keyId)),
      deleteItem(userApiKeyKey(userId, keyId)),
    ]);

    logger.info({ userId, keyId }, 'API key deleted');
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private toUser(entity: UserEntity): User {
    const { PK, SK, GSI1PK, GSI1SK, ...user } = entity;
    return user;
  }

  private toApiKey(entity: ApiKeyEntity): ApiKey {
    const { PK, SK, keyHash, ...apiKey } = entity;
    return apiKey;
  }
}

// Export singleton
export const userRepository = new UserRepository();
