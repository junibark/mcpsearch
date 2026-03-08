/**
 * Error Handler Middleware
 *
 * Centralized error handling for the API.
 */

import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES, HTTP_STATUS } from '@mcpsearch/shared';
import { logger } from '../lib/logger.js';
import { ApiError } from './api-error.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Log error
  logger.error(
    {
      err,
      method: req.method,
      url: req.url,
      requestId: req.headers['x-request-id'],
    },
    'Request error'
  );

  // Handle known error types
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: {
          errors: err.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      },
    });
    return;
  }

  // Handle syntax errors (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid JSON body',
      },
    });
    return;
  }

  // Unknown errors
  const message =
    process.env['NODE_ENV'] === 'production' ? 'An unexpected error occurred' : err.message;

  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: ERROR_CODES.UNKNOWN_ERROR,
      message,
    },
  });
};
