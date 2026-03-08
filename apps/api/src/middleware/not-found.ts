/**
 * Not Found Handler
 *
 * Handles requests to non-existent routes.
 */

import type { RequestHandler } from 'express';
import { ERROR_CODES, HTTP_STATUS } from '@mcpsearch/shared';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};
