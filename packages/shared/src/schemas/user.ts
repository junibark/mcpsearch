/**
 * User Validation Schemas
 *
 * Zod schemas for validating user-related data.
 */

import { z } from 'zod';

// Username format
export const usernameSchema = z
  .string()
  .min(3)
  .max(39)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Username must be lowercase alphanumeric with hyphens');

// Email
export const emailSchema = z.string().email().max(255);

// Display name
export const displayNameSchema = z.string().min(1).max(100);

// Bio
export const bioSchema = z.string().max(500);

// Social links
export const socialLinksSchema = z.object({
  github: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/, 'GitHub username only')
    .max(39)
    .optional()
    .nullable(),
  twitter: z
    .string()
    .regex(/^[a-zA-Z0-9_]+$/, 'Twitter handle only')
    .max(15)
    .optional()
    .nullable(),
  linkedin: z.string().max(100).optional().nullable(),
  website: z.string().url().max(200).optional().nullable(),
});

// User preferences
export const userPreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

// API key scopes
export const apiKeyScopeSchema = z.enum([
  'read:packages',
  'write:packages',
  'read:profile',
  'write:profile',
  'read:analytics',
  'admin',
]);

// Update user request
export const updateUserRequestSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: bioSchema.optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  company: z.string().max(100).optional().nullable(),
  socialLinks: socialLinksSchema.optional(),
  preferences: userPreferencesSchema.optional(),
});

// Create API key request
export const createApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(50),
  scopes: z.array(apiKeyScopeSchema).min(1).max(10),
  expiresAt: z.string().datetime().optional(),
});

// Export types
export type UpdateUserInput = z.infer<typeof updateUserRequestSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeyRequestSchema>;
