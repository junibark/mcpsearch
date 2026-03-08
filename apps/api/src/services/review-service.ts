/**
 * Review Service
 *
 * Business logic for review operations.
 */

import type { Review } from '@mcpsearch/shared';
import { reviewRepository } from '../repositories/review-repository.js';
import { packageRepository } from '../repositories/package-repository.js';
import { userService } from './user-service.js';
import { logger } from '../lib/logger.js';

// =============================================================================
// Review Service
// =============================================================================

export class ReviewService {
  // ===========================================================================
  // Get Operations
  // ===========================================================================

  async getById(packageId: string, reviewId: string): Promise<Review | null> {
    return reviewRepository.getById(packageId, reviewId);
  }

  async getByUserAndPackage(
    userId: string,
    packageId: string
  ): Promise<Review | null> {
    return reviewRepository.getByUserAndPackage(userId, packageId);
  }

  async listByPackage(
    packageId: string,
    options: {
      limit?: number;
      sort?: 'recent' | 'helpful';
    } = {}
  ): Promise<Review[]> {
    return reviewRepository.listByPackage(packageId, options);
  }

  async listByUser(userId: string, limit: number = 50): Promise<Review[]> {
    return reviewRepository.listByUser(userId, limit);
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  async create(
    packageId: string,
    userId: string,
    input: {
      rating: number;
      title?: string;
      content?: string;
    }
  ): Promise<Review> {
    // Validate rating
    if (input.rating < 1 || input.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Get user for username
    const user = await userService.getById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get package to verify it exists and get latest version
    const pkg = await packageRepository.getById(packageId);
    if (!pkg) {
      throw new Error('Package not found');
    }

    const review = await reviewRepository.create({
      packageId,
      userId,
      username: user.username,
      rating: input.rating,
      title: input.title,
      content: input.content,
      version: pkg.latestVersion,
    });

    // Update package review stats
    await this.updatePackageStats(packageId);

    logger.info(
      { reviewId: review.reviewId, packageId, userId, rating: input.rating },
      'Review created'
    );

    return review;
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
    // Validate rating if provided
    if (updates.rating && (updates.rating < 1 || updates.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    const review = await reviewRepository.update(packageId, reviewId, userId, updates);

    if (review && updates.rating) {
      // Update package stats if rating changed
      await this.updatePackageStats(packageId);
    }

    return review;
  }

  async markHelpful(
    packageId: string,
    reviewId: string,
    userId: string
  ): Promise<void> {
    // Check if review exists
    const review = await this.getById(packageId, reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Don't allow users to mark their own reviews as helpful
    if (review.userId === userId) {
      throw new Error('You cannot mark your own review as helpful');
    }

    await reviewRepository.markHelpful(packageId, reviewId);
  }

  async report(
    packageId: string,
    reviewId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    // Check if review exists
    const review = await this.getById(packageId, reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    await reviewRepository.report(packageId, reviewId);

    logger.info(
      { reviewId, packageId, reportedBy: userId, reason },
      'Review reported'
    );
  }

  // ===========================================================================
  // Delete Operations
  // ===========================================================================

  async delete(
    packageId: string,
    reviewId: string,
    userId: string
  ): Promise<void> {
    await reviewRepository.delete(packageId, reviewId, userId);

    // Update package stats
    await this.updatePackageStats(packageId);
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  async getPackageStats(packageId: string): Promise<{
    averageRating: number;
    reviewCount: number;
    ratingDistribution: Record<number, number>;
  }> {
    return reviewRepository.getPackageStats(packageId);
  }

  private async updatePackageStats(packageId: string): Promise<void> {
    try {
      const stats = await this.getPackageStats(packageId);

      await packageRepository.update(packageId, {
        stats: {
          averageRating: stats.averageRating,
          reviewCount: stats.reviewCount,
        },
      } as never);
    } catch (error) {
      logger.error({ error, packageId }, 'Failed to update package stats');
    }
  }
}

// Export singleton
export const reviewService = new ReviewService();
