import { describe, it, expect } from 'vitest';
import {
  packageIdSchema,
  versionSchema,
  searchParamsSchema,
} from '../schemas/package';

describe('Package Schemas', () => {
  describe('packageIdSchema', () => {
    it('should validate a scoped package ID', () => {
      const result = packageIdSchema.safeParse('@test/mcp-server');
      expect(result.success).toBe(true);
    });

    it('should validate an unscoped package ID', () => {
      const result = packageIdSchema.safeParse('mcp-server');
      expect(result.success).toBe(true);
    });

    it('should reject invalid package ID with uppercase', () => {
      const result = packageIdSchema.safeParse('@Test/MCP-Server');
      expect(result.success).toBe(false);
    });

    it('should reject package ID with invalid characters', () => {
      const result = packageIdSchema.safeParse('@test/mcp_server!');
      expect(result.success).toBe(false);
    });
  });

  describe('versionSchema', () => {
    it('should validate a valid semver version', () => {
      const result = versionSchema.safeParse('1.0.0');
      expect(result.success).toBe(true);
    });

    it('should validate a version with prerelease tag', () => {
      const result = versionSchema.safeParse('1.0.0-beta.1');
      expect(result.success).toBe(true);
    });

    it('should validate a version with build metadata', () => {
      const result = versionSchema.safeParse('1.0.0+build.123');
      expect(result.success).toBe(true);
    });

    it('should reject invalid semver', () => {
      const result = versionSchema.safeParse('not-a-version');
      expect(result.success).toBe(false);
    });

    it('should reject partial version', () => {
      const result = versionSchema.safeParse('1.0');
      expect(result.success).toBe(false);
    });
  });

  describe('searchParamsSchema', () => {
    it('should validate a valid search query', () => {
      const validQuery = {
        q: 'filesystem',
        category: 'utilities',
        page: 1,
        limit: 20,
        sort: 'downloads',
      };

      const result = searchParamsSchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it('should apply default values', () => {
      const minimalQuery = {
        q: 'test',
      };

      const result = searchParamsSchema.safeParse(minimalQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sort).toBe('relevance');
      }
    });

    it('should reject invalid sort option', () => {
      const invalidQuery = {
        q: 'test',
        sort: 'invalid-sort',
      };

      const result = searchParamsSchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it('should reject empty query string', () => {
      const result = searchParamsSchema.safeParse({ q: '' });
      expect(result.success).toBe(false);
    });
  });
});
