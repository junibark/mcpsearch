/**
 * Review Routes
 *
 * Package reviews and ratings.
 * Note: Reviews are primarily accessed via /packages/:packageId/reviews
 * These routes provide direct review access by ID.
 */

import { Router } from 'express';
import type { RequestHandler, Request } from 'express';
import { updateReviewRequestSchema } from '@mcpsearch/shared';
import { ApiError } from '../middleware/api-error.js';
import { logger } from '../lib/logger.js';
import { reviewService } from '../services/review-service.js';

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
 * GET /reviews/user/:userId
 * Get reviews by a specific user
 */
const getUserReviews: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(Number(req.query['limit']) || 20, 50);

    if (!userId) {
      throw ApiError.badRequest('User ID is required');
    }

    logger.debug({ userId, limit }, 'Getting user reviews');

    const reviews = await reviewService.listByUser(userId, limit);

    res.json({
      success: true,
      data: { reviews },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /reviews/:packageId/:reviewId
 * Update a review (author only)
 */
const updateReview: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const { packageId, reviewId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!packageId || !reviewId) {
      throw ApiError.badRequest('Package ID and Review ID are required');
    }

    const input = updateReviewRequestSchema.parse(req.body);

    logger.debug({ reviewId, packageId, userId, input }, 'Updating review');

    const review = await reviewService.update(packageId, reviewId, userId, {
      rating: input.rating,
      title: input.title ?? undefined,
      content: input.body,
    });

    if (!review) {
      throw ApiError.notFound('Review not found');
    }

    res.json({
      success: true,
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /reviews/:packageId/:reviewId
 * Delete a review (author only)
 */
const deleteReview: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const { packageId, reviewId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!packageId || !reviewId) {
      throw ApiError.badRequest('Package ID and Review ID are required');
    }

    logger.info({ reviewId, packageId, userId }, 'Deleting review');

    await reviewService.delete(packageId, reviewId, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /reviews/:packageId/:reviewId/helpful
 * Mark a review as helpful
 */
const markHelpful: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const { packageId, reviewId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!packageId || !reviewId) {
      throw ApiError.badRequest('Package ID and Review ID are required');
    }

    logger.debug({ reviewId, packageId, userId }, 'Marking review helpful');

    await reviewService.markHelpful(packageId, reviewId, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /reviews/:packageId/:reviewId/report
 * Report a review
 */
const reportReview: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const { packageId, reviewId } = req.params;
    const userId = req.user?.userId;
    const { reason } = req.body;

    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!packageId || !reviewId) {
      throw ApiError.badRequest('Package ID and Review ID are required');
    }

    if (!reason) {
      throw ApiError.badRequest('Reason is required');
    }

    logger.info({ reviewId, packageId, userId, reason }, 'Reporting review');

    await reviewService.report(packageId, reviewId, userId, reason);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// User's reviews (public)
router.get('/user/:userId', getUserReviews);

// Review operations (require packageId for proper keying)
router.patch('/:packageId/:reviewId', updateReview);
router.delete('/:packageId/:reviewId', deleteReview);
router.post('/:packageId/:reviewId/helpful', markHelpful);
router.post('/:packageId/:reviewId/report', reportReview);

export { router as reviewsRouter };
