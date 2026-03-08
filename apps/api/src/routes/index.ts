/**
 * API Routes
 *
 * Main router that combines all API routes.
 */

import { Router } from 'express';
import { packagesRouter } from './packages.js';
import { searchRouter } from './search.js';
import { usersRouter } from './users.js';
import { reviewsRouter } from './reviews.js';
import { categoriesRouter } from './categories.js';
import { cliRouter } from './cli.js';
import { authRouter } from './auth.js';

export function createRouter(): Router {
  const router = Router();

  // Package routes
  router.use('/packages', packagesRouter);

  // Search routes
  router.use('/search', searchRouter);

  // User routes
  router.use('/users', usersRouter);

  // Review routes
  router.use('/reviews', reviewsRouter);

  // Category routes
  router.use('/categories', categoriesRouter);

  // CLI-specific routes
  router.use('/cli', cliRouter);

  // Auth routes
  router.use('/auth', authRouter);

  return router;
}
