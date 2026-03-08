/**
 * Review Validation Schemas
 *
 * Zod schemas for validating review-related data.
 */

import { z } from 'zod';
import { versionSchema } from './package.js';

// Rating (1-5 stars)
export const ratingSchema = z.number().int().min(1).max(5);

// Review title
export const reviewTitleSchema = z.string().min(3).max(100);

// Review body
export const reviewBodySchema = z.string().min(10).max(5000);

// Tool used
export const toolUsedSchema = z.enum([
  'claudeCode',
  'cursor',
  'windsurf',
  'continueDev',
  'other',
]);

// Create review request
export const createReviewRequestSchema = z.object({
  rating: ratingSchema,
  title: reviewTitleSchema.optional(),
  body: reviewBodySchema,
  versionReviewed: versionSchema,
  toolUsed: toolUsedSchema.optional(),
});

// Update review request
export const updateReviewRequestSchema = z.object({
  rating: ratingSchema.optional(),
  title: reviewTitleSchema.optional().nullable(),
  body: reviewBodySchema.optional(),
});

// Respond to review request
export const respondToReviewRequestSchema = z.object({
  body: z.string().min(10).max(2000),
});

// Get reviews params
export const getReviewsParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['recent', 'helpful', 'rating']).default('recent'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

// Export types
export type CreateReviewInput = z.infer<typeof createReviewRequestSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewRequestSchema>;
export type RespondToReviewInput = z.infer<typeof respondToReviewRequestSchema>;
export type GetReviewsInput = z.infer<typeof getReviewsParamsSchema>;
