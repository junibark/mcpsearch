import type { Review } from '@mcpsearch/shared';
import {
  getItem,
  putItem,
  updateItem,
  deleteItem,
  query,
  queryAll,
} from '../lib/aws/dynamodb.js';
import { logger } from '../lib/logger.js';
import { v4 as uuid } from 'uuid';

// =============================================================================
// Key Helpers
// =============================================================================

function reviewKey(packageId: string, reviewId: string) {
  return {
    PK: `PKG#${packageId}`,
    SK: `REVIEW#${reviewId}`,
  };
}

function userReviewKey(userId: string, packageId: string) {
  return {
    PK: `USER#${userId}`,
    SK: `REVIEW#${packageId}`,
  };
}

// =============================================================================
// Entity Types
// =============================================================================

interface ReviewEntity extends Review {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

interface UserReviewRef {
  PK: string;
  SK: string;
  reviewId: string;
  packageId: string;
  rating: number;
  createdAt: string;
}

// =============================================================================
// Review Repository
// =============================================================================

export class ReviewRepository {
  // ===========================================================================
  // Get Operations
  // ===========================================================================

  async getById(packageId: string, reviewId: string): Promise<Review | null> {
    const entity = await getItem<ReviewEntity>(reviewKey(packageId, reviewId));
    if (!entity) return null;
    return this.toReview(entity);
  }

  async getByUserAndPackage(
    userId: string,
    packageId: string
  ): Promise<Review | null> {
    const ref = await getItem<UserReviewRef>(userReviewKey(userId, packageId));
    if (!ref) return null;
    return this.getById(packageId, ref.reviewId);
  }

  async listByPackage(
    packageId: string,
    options: {
      limit?: number;
      sort?: 'recent' | 'helpful';
    } = {}
  ): Promise<Review[]> {
    const { limit = 20, sort = 'recent' } = options;

    const result = await query<ReviewEntity>({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `PKG#${packageId}`,
        ':sk': 'REVIEW#',
      },
      Limit: limit,
      ScanIndexForward: false, // Most recent first
    });

    let reviews = result.items.map((e) => this.toReview(e));

    if (sort === 'helpful') {
      reviews = reviews.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0));
    }

    return reviews;
  }

  async listByUser(userId: string, limit: number = 50): Promise<Review[]> {
    const refs = await query<UserReviewRef>({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'REVIEW#',
      },
      Limit: limit,
      ScanIndexForward: false,
    });

    const reviews: Review[] = [];
    for (const ref of refs.items) {
      const review = await this.getById(ref.packageId, ref.reviewId);
      if (review) {
        reviews.push(review);
      }
    }

    return reviews;
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  async create(input: {
    packageId: string;
    userId: string;
    username: string;
    rating: number;
    title?: string;
    content?: string;
    version?: string;
  }): Promise<Review> {
    // Check if user already reviewed this package
    const existing = await this.getByUserAndPackage(input.userId, input.packageId);
    if (existing) {
      throw new Error('You have already reviewed this package');
    }

    const now = new Date().toISOString();
    const reviewId = `rev_${uuid().replace(/-/g, '')}`;

    const reviewEntity: ReviewEntity = {
      PK: `PKG#${input.packageId}`,
      SK: `REVIEW#${reviewId}`,
      GSI1PK: `USER#${input.userId}`,
      GSI1SK: `REVIEW#${now}`,

      reviewId,
      packageId: input.packageId,
      userId: input.userId,
      username: input.username,
      rating: input.rating,
      title: input.title,
      content: input.content,
      version: input.version,
      helpfulCount: 0,
      reportCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const userRef: UserReviewRef = {
      PK: `USER#${input.userId}`,
      SK: `REVIEW#${input.packageId}`,
      reviewId,
      packageId: input.packageId,
      rating: input.rating,
      createdAt: now,
    };

    await Promise.all([
      putItem({ Item: reviewEntity }),
      putItem({ Item: userRef }),
    ]);

    logger.info(
      { reviewId, packageId: input.packageId, userId: input.userId, rating: input.rating },
      'Review created'
    );

    return this.toReview(reviewEntity);
  }

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  async update(
    packageId: string,
    reviewId: string,
    userId: string,
    updates: {
      rating?: number;
      title?: string;
      content?: string;
    }
  ): Promise<Review | null> {
    // Verify ownership
    const existing = await this.getById(packageId, reviewId);
    if (!existing) return null;
    if (existing.userId !== userId) {
      throw new Error('You can only edit your own reviews');
    }

    const now = new Date().toISOString();

    await updateItem({
      Key: reviewKey(packageId, reviewId),
      UpdateExpression: 'SET #rating = :rating, title = :title, content = :content, updatedAt = :now',
      ExpressionAttributeNames: {
        '#rating': 'rating',
      },
      ExpressionAttributeValues: {
        ':rating': updates.rating ?? existing.rating,
        ':title': updates.title ?? existing.title,
        ':content': updates.content ?? existing.content,
        ':now': now,
      },
    });

    // Update user ref if rating changed
    if (updates.rating && updates.rating !== existing.rating) {
      await updateItem({
        Key: userReviewKey(userId, packageId),
        UpdateExpression: 'SET #rating = :rating',
        ExpressionAttributeNames: { '#rating': 'rating' },
        ExpressionAttributeValues: { ':rating': updates.rating },
      });
    }

    return this.getById(packageId, reviewId);
  }

  async markHelpful(packageId: string, reviewId: string): Promise<void> {
    await updateItem({
      Key: reviewKey(packageId, reviewId),
      UpdateExpression: 'SET helpfulCount = if_not_exists(helpfulCount, :zero) + :one',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
      },
    });
  }

  async report(packageId: string, reviewId: string): Promise<void> {
    await updateItem({
      Key: reviewKey(packageId, reviewId),
      UpdateExpression: 'SET reportCount = if_not_exists(reportCount, :zero) + :one',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
      },
    });
  }

  // ===========================================================================
  // Delete Operations
  // ===========================================================================

  async delete(
    packageId: string,
    reviewId: string,
    userId: string
  ): Promise<void> {
    // Verify ownership
    const existing = await this.getById(packageId, reviewId);
    if (!existing) {
      throw new Error('Review not found');
    }
    if (existing.userId !== userId) {
      throw new Error('You can only delete your own reviews');
    }

    await Promise.all([
      deleteItem(reviewKey(packageId, reviewId)),
      deleteItem(userReviewKey(userId, packageId)),
    ]);

    logger.info({ reviewId, packageId, userId }, 'Review deleted');
  }

  // ===========================================================================
  // Aggregation
  // ===========================================================================

  async getPackageStats(packageId: string): Promise<{
    averageRating: number;
    reviewCount: number;
    ratingDistribution: Record<number, number>;
  }> {
    const reviews = await queryAll<ReviewEntity>({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `PKG#${packageId}`,
        ':sk': 'REVIEW#',
      },
      ProjectionExpression: 'rating',
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        reviewCount: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const review of reviews) {
      const rating = review.rating;
      sum += rating;
      distribution[rating] = (distribution[rating] || 0) + 1;
    }

    return {
      averageRating: Math.round((sum / reviews.length) * 10) / 10,
      reviewCount: reviews.length,
      ratingDistribution: distribution,
    };
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private toReview(entity: ReviewEntity): Review {
    const { PK, SK, GSI1PK, GSI1SK, ...review } = entity;
    return review;
  }
}

// Export singleton
export const reviewRepository = new ReviewRepository();
