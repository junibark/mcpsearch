/**
 * User Routes
 *
 * User profile management.
 */

import { Router } from 'express';
import type { RequestHandler, Request } from 'express';
import { updateUserRequestSchema, createApiKeyRequestSchema } from '@mcpsearch/shared';
import { ApiError } from '../middleware/api-error.js';
import { logger } from '../lib/logger.js';
import { userService } from '../services/user-service.js';
import { packageService } from '../services/package-service.js';

const router = Router();

// Extend Request to include user from auth middleware
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    email: string;
  };
}

/**
 * GET /users/me
 * Get current user profile
 */
const getMe: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    logger.debug({ userId }, 'Getting current user');

    const user = await userService.getById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /users/me
 * Update current user profile
 */
const updateMe: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const input = updateUserRequestSchema.parse(req.body);

    logger.debug({ userId, input }, 'Updating current user');

    const user = await userService.updateProfile(userId, input);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/:username
 * Get public user profile
 */
const getUser: RequestHandler = async (req, res, next) => {
  try {
    const { username } = req.params;

    if (!username) {
      throw ApiError.badRequest('Username is required');
    }

    logger.debug({ username }, 'Getting user profile');

    const user = await userService.getByUsername(username);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Get user's packages
    const packagesResult = await packageService.listByPublisher(user.userId, {
      limit: 10,
      sort: 'downloads',
    });

    // Return sanitized public user data
    const publicUser = {
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      website: user.website,
      github: user.github,
      twitter: user.twitter,
      publisherStatus: user.publisherStatus,
      stats: user.stats,
      createdAt: user.createdAt,
    };

    res.json({
      success: true,
      data: {
        user: publicUser,
        packages: packagesResult.items,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/:username/packages
 * Get user's packages
 */
const getUserPackages: RequestHandler = async (req, res, next) => {
  try {
    const { username } = req.params;
    const page = Number(req.query['page']) || 1;
    const limit = Math.min(Number(req.query['limit']) || 20, 100);

    if (!username) {
      throw ApiError.badRequest('Username is required');
    }

    logger.debug({ username, page, limit }, 'Getting user packages');

    const user = await userService.getByUsername(username);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const result = await packageService.listByPublisher(user.userId, {
      limit,
      offset: (page - 1) * limit,
      sort: 'downloads',
    });

    res.json({
      success: true,
      data: {
        items: result.items,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasMore: page * limit < result.total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /users/me/api-keys
 * Create a new API key
 */
const createApiKey: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const input = createApiKeyRequestSchema.parse(req.body);

    logger.info({ userId, name: input.name }, 'Creating API key');

    const result = await userService.createApiKey(
      userId,
      input.name,
      input.scopes,
      input.expiresInDays
    );

    res.status(201).json({
      success: true,
      data: {
        keyId: result.apiKey.keyId,
        apiKey: result.rawKey, // Only shown once
        name: result.apiKey.name,
        scopes: result.apiKey.scopes,
        expiresAt: result.apiKey.expiresAt,
        createdAt: result.apiKey.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/me/api-keys
 * List API keys
 */
const listApiKeys: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    logger.debug({ userId }, 'Listing API keys');

    const keys = await userService.listApiKeys(userId);

    res.json({
      success: true,
      data: { keys },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /users/me/api-keys/:keyId
 * Revoke an API key
 */
const revokeApiKey: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const { keyId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!keyId) {
      throw ApiError.badRequest('Key ID is required');
    }

    logger.info({ userId, keyId }, 'Revoking API key');

    await userService.deleteApiKey(userId, keyId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Public routes
router.get('/:username', getUser);
router.get('/:username/packages', getUserPackages);

// Protected routes (TODO: add authenticate middleware)
router.get('/me', getMe);
router.patch('/me', updateMe);
router.post('/me/api-keys', createApiKey);
router.get('/me/api-keys', listApiKeys);
router.delete('/me/api-keys/:keyId', revokeApiKey);

export { router as usersRouter };
