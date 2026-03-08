import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from './api-error.js';

// =============================================================================
// Types
// =============================================================================

interface ValidationOptions {
  stripUnknown?: boolean;
}

type ValidationTarget = 'body' | 'query' | 'params';

// =============================================================================
// Validation Middleware Factory
// =============================================================================

export function validate<T>(
  schema: ZodSchema<T>,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        next(
          ApiError.badRequest(`Validation failed: ${errors.join(', ')}`, {
            errors: result.error.errors,
          })
        );
        return;
      }

      // Replace with parsed (and potentially transformed) data
      if (options.stripUnknown !== false) {
        req[target] = result.data as typeof req[typeof target];
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Convenience Exports
// =============================================================================

export function validateBody<T>(
  schema: ZodSchema<T>,
  options?: ValidationOptions
) {
  return validate(schema, 'body', options);
}

export function validateQuery<T>(
  schema: ZodSchema<T>,
  options?: ValidationOptions
) {
  return validate(schema, 'query', options);
}

export function validateParams<T>(
  schema: ZodSchema<T>,
  options?: ValidationOptions
) {
  return validate(schema, 'params', options);
}

// =============================================================================
// Error Formatting
// =============================================================================

function formatZodErrors(error: ZodError): string[] {
  return error.errors.map((err) => {
    const path = err.path.join('.');
    if (path) {
      return `${path}: ${err.message}`;
    }
    return err.message;
  });
}

// =============================================================================
// Common Validation Schemas
// =============================================================================

import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const sortSchema = z.object({
  sort: z.enum(['downloads', 'rating', 'recent', 'relevance']).default('relevance'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const packageIdParamSchema = z.object({
  packageId: z
    .string()
    .regex(/^@[\w-]+\/[\w-]+$/, 'Invalid package ID format'),
});
