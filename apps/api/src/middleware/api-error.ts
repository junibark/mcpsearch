/**
 * API Error Class
 *
 * Custom error class for API errors with status codes.
 */

import { ERROR_CODES, HTTP_STATUS, type ErrorCode } from '@mcpsearch/shared';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  // Factory methods for common errors
  static badRequest(message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Access denied'): ApiError {
    return new ApiError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(resource: string): ApiError {
    return new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, `${resource} not found`);
  }

  static conflict(message: string): ApiError {
    return new ApiError(HTTP_STATUS.CONFLICT, ERROR_CODES.PACKAGE_ALREADY_EXISTS, message);
  }

  static rateLimited(message = 'Too many requests'): ApiError {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMITED, message);
  }

  static packageNotFound(packageId: string): ApiError {
    return new ApiError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.PACKAGE_NOT_FOUND,
      `Package '${packageId}' not found`
    );
  }

  static versionNotFound(packageId: string, version: string): ApiError {
    return new ApiError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.PACKAGE_NOT_FOUND,
      `Version '${version}' of package '${packageId}' not found`
    );
  }

  static userNotFound(identifier: string): ApiError {
    return new ApiError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.USER_NOT_FOUND,
      `User '${identifier}' not found`
    );
  }

  static invalidToken(message = 'Invalid or expired token'): ApiError {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_TOKEN, message);
  }

  static insufficientScopes(required: string[]): ApiError {
    return new ApiError(
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.INSUFFICIENT_SCOPES,
      `Insufficient permissions. Required scopes: ${required.join(', ')}`
    );
  }
}
