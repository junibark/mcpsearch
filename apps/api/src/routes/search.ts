/**
 * Search Routes
 *
 * Full-text search and suggestions.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { packageService } from '../services/package-service.js';
import { getCategoryFacets } from '../lib/search.js';
import { apiRateLimit, searchRateLimit } from '../middleware/rate-limit.js';
import { logger } from '../lib/logger.js';

const router = Router();

// =============================================================================
// Query Schemas
// =============================================================================

const searchQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  tool: z.string().optional(),
  tags: z
    .string()
    .optional()
    .transform((v) => v?.split(',').filter(Boolean)),
  capabilities: z
    .string()
    .optional()
    .transform((v) => v?.split(',').filter(Boolean)),
  verificationStatus: z.enum(['unverified', 'verified', 'official']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'downloads', 'rating', 'recent']).default('relevance'),
});

const suggestQuerySchema = z.object({
  q: z.string().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

// =============================================================================
// GET /search - Full-text search
// =============================================================================

const search: RequestHandler = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const params = searchQuerySchema.parse(req.query);

    logger.debug({ params }, 'Search request');

    const result = await packageService.search({
      query: params.q,
      category: params.category,
      tool: params.tool,
      tags: params.tags,
      capabilities: params.capabilities,
      verificationStatus: params.verificationStatus,
      page: params.page,
      limit: params.limit,
      sort: params.sort,
    });

    // Get facets for filters
    const categoryFacets = await getCategoryFacets();

    const queryTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        packages: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasMore: result.page < result.totalPages,
        },
        facets: {
          categories: categoryFacets,
        },
        queryTime,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /search/suggest - Autocomplete suggestions
// =============================================================================

const suggest: RequestHandler = async (req, res, next) => {
  try {
    const params = suggestQuerySchema.parse(req.query);

    logger.debug({ q: params.q, limit: params.limit }, 'Suggest request');

    const suggestions = await packageService.suggest(params.q, params.limit);

    res.json({
      success: true,
      data: {
        suggestions: suggestions.map((s) => ({
          text: s.text,
          packageId: s.packageId,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// Register Routes
// =============================================================================

router.get('/', searchRateLimit, search);
router.get('/suggest', apiRateLimit, suggest);

export { router as searchRouter };
