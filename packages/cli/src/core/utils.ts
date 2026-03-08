/**
 * CLI Utilities
 *
 * Helper functions for the CLI.
 */

import * as semver from 'semver';

export interface PackageSpec {
  name: string;
  version?: string;
  tag?: string;
}

/**
 * Parse a package specification string
 * Examples:
 *   "@anthropic/mcp-server-filesystem"
 *   "@anthropic/mcp-server-filesystem@1.2.3"
 *   "@anthropic/mcp-server-filesystem@^1.0.0"
 *   "mcp-server-fetch@latest"
 */
export function parsePackageSpec(spec: string): PackageSpec {
  // Handle scoped packages (@scope/name)
  const scopedMatch = spec.match(/^(@[^@/]+\/[^@]+)(?:@(.+))?$/);
  if (scopedMatch) {
    const [, name, versionOrTag] = scopedMatch;
    return parseVersionOrTag(name!, versionOrTag);
  }

  // Handle non-scoped packages
  const match = spec.match(/^([^@]+)(?:@(.+))?$/);
  if (match) {
    const [, name, versionOrTag] = match;
    return parseVersionOrTag(name!, versionOrTag);
  }

  return { name: spec };
}

function parseVersionOrTag(name: string, versionOrTag?: string): PackageSpec {
  if (!versionOrTag) {
    return { name };
  }

  // Check if it's a valid semver or range
  if (semver.validRange(versionOrTag)) {
    return { name, version: versionOrTag };
  }

  // Treat as tag
  return { name, tag: versionOrTag };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format a duration in milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!(
    process.env['CI'] ||
    process.env['CONTINUOUS_INTEGRATION'] ||
    process.env['GITHUB_ACTIONS'] ||
    process.env['GITLAB_CI'] ||
    process.env['CIRCLECI']
  );
}

/**
 * Get platform info
 */
export function getPlatformInfo(): {
  platform: string;
  arch: string;
  nodeVersion: string;
} {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
  };
}

/**
 * Generate a simple session ID
 */
export function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15);
}
