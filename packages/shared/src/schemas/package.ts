/**
 * Package Validation Schemas
 *
 * Zod schemas for validating package-related data.
 */

import { z } from 'zod';

// Package ID format: @scope/name or just name
export const packageIdSchema = z
  .string()
  .min(1)
  .max(214)
  .regex(
    /^(@[a-z0-9-]+\/)?[a-z0-9-]+$/,
    'Package ID must be lowercase alphanumeric with optional @scope/ prefix'
  );

// Semver version
export const versionSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/,
    'Version must be valid semver (e.g., 1.2.3, 1.0.0-beta.1)'
  );

// Version range (semver range)
export const versionRangeSchema = z.string().min(1).max(100);

// Package status
export const packageStatusSchema = z.enum(['pending', 'published', 'deprecated', 'removed']);

// Verification status
export const verificationStatusSchema = z.enum(['unverified', 'verified', 'official']);

// Security scan status
export const securityScanStatusSchema = z.enum(['pending', 'passed', 'failed', 'warning']);

// MCP capabilities
export const mcpCapabilitySchema = z.enum(['tools', 'resources', 'prompts', 'sampling']);

// Tool compatibility
export const toolCompatibilitySchema = z.object({
  supported: z.boolean(),
  minVersion: z.string().optional(),
  maxVersion: z.string().optional(),
  installCommand: z.string().max(500).optional(),
  configSnippet: z.string().max(2000).optional(),
  notes: z.string().max(500).optional(),
});

// Package compatibility
export const packageCompatibilitySchema = z.object({
  claudeCode: toolCompatibilitySchema,
  cursor: toolCompatibilitySchema,
  windsurf: toolCompatibilitySchema,
  continueDev: toolCompatibilitySchema,
  custom: z.record(z.string(), toolCompatibilitySchema).optional(),
});

// Repository
export const repositorySchema = z.object({
  type: z.enum(['github', 'gitlab', 'bitbucket', 'other']),
  url: z.string().url(),
  branch: z.string().optional(),
  directory: z.string().optional(),
});

// MCP Tool definition
export const mcpToolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  inputSchema: z.record(z.unknown()).optional(),
});

// MCP Resource definition
export const mcpResourceSchema = z.object({
  uri: z.string().min(1).max(500),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  mimeType: z.string().max(100).optional(),
});

// MCP Prompt definition
export const mcpPromptSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  arguments: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        description: z.string().max(200).optional(),
        required: z.boolean().optional(),
      })
    )
    .optional(),
});

// MCP Manifest
export const mcpManifestSchema = z.object({
  version: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  tools: z.array(mcpToolSchema).optional(),
  resources: z.array(mcpResourceSchema).optional(),
  prompts: z.array(mcpPromptSchema).optional(),
});

// Publish package request
export const publishPackageRequestSchema = z.object({
  name: z.string().min(1).max(100),
  version: versionSchema,
  description: z.string().min(10).max(5000),
  shortDescription: z.string().min(10).max(150),
  category: z.string().min(1).max(50),
  tags: z.array(z.string().min(1).max(30)).min(1).max(10),
  license: z.string().min(1).max(50),
  repository: repositorySchema.optional(),
  readme: z.string().max(100000),
  mcpManifest: mcpManifestSchema,
});

// Update package request
export const updatePackageRequestSchema = z.object({
  description: z.string().min(10).max(5000).optional(),
  shortDescription: z.string().min(10).max(150).optional(),
  category: z.string().min(1).max(50).optional(),
  tags: z.array(z.string().min(1).max(30)).min(1).max(10).optional(),
  homepage: z.string().url().optional().nullable(),
  documentation: z.string().url().optional().nullable(),
  changelog: z.string().url().optional().nullable(),
});

// List packages params
export const listPackagesParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  tool: z.enum(['claudeCode', 'cursor', 'windsurf', 'continueDev']).optional(),
  sort: z.enum(['downloads', 'recent', 'rating', 'name']).default('downloads'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Search params
export const searchParamsSchema = z.object({
  q: z.string().min(1).max(200),
  category: z.string().optional(),
  tool: z.enum(['claudeCode', 'cursor', 'windsurf', 'continueDev']).optional(),
  license: z.string().optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['relevance', 'downloads', 'recent', 'rating']).default('relevance'),
});

// Export types inferred from schemas
export type PublishPackageInput = z.infer<typeof publishPackageRequestSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageRequestSchema>;
export type ListPackagesInput = z.infer<typeof listPackagesParamsSchema>;
export type SearchInput = z.infer<typeof searchParamsSchema>;
