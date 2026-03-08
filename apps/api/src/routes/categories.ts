/**
 * Category Routes
 *
 * Package categories and taxonomy.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { CATEGORIES } from '@mcpsearch/shared';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /categories
 * List all categories
 */
const listCategories: RequestHandler = async (req, res, next) => {
  try {
    logger.debug('Listing categories');

    // TODO: Add package counts from DynamoDB
    const categories = Object.values(CATEGORIES).map((cat) => ({
      ...cat,
      packageCount: 0, // TODO: Get from DynamoDB
    }));

    res.json({
      success: true,
      data: {
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /categories/:categoryId
 * Get category details
 */
const getCategory: RequestHandler = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    logger.debug({ categoryId }, 'Getting category');

    const category = CATEGORIES[categoryId as keyof typeof CATEGORIES];

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Category '${categoryId}' not found`,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        category: {
          ...category,
          packageCount: 0, // TODO: Get from DynamoDB
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

router.get('/', listCategories);
router.get('/:categoryId', getCategory);

export { router as categoriesRouter };
