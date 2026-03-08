/**
 * Seed Data Provider
 *
 * Provides mock data from seed files when DynamoDB is unavailable.
 * Used for local development without LocalStack.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Package, PackageVersion } from '@mcpsearch/shared';
import { logger } from './logger.js';

let seedPackages: Package[] | null = null;
let seedLoadAttempted = false;

const SEED_DATA_PATHS = [
  // Try multiple locations
  path.resolve(process.cwd(), '../../data/seed-packages.json'),
  path.resolve(process.cwd(), '../data/seed-packages.json'),
  path.resolve(process.cwd(), './data/seed-packages.json'),
  path.resolve(process.cwd(), '../worker/data/mcp-packages.json'),
];

/**
 * Load seed data from JSON file
 */
async function loadSeedData(): Promise<Package[]> {
  if (seedPackages !== null) {
    return seedPackages;
  }

  if (seedLoadAttempted) {
    return [];
  }

  seedLoadAttempted = true;

  for (const seedPath of SEED_DATA_PATHS) {
    try {
      const data = await fs.readFile(seedPath, 'utf-8');
      seedPackages = JSON.parse(data) as Package[];
      logger.info({ path: seedPath, count: seedPackages.length }, 'Loaded seed data');
      return seedPackages;
    } catch {
      // Try next path
    }
  }

  logger.warn('No seed data found, using empty dataset');
  seedPackages = [];
  return seedPackages;
}

/**
 * Get all packages from seed data
 */
export async function getSeedPackages(): Promise<Package[]> {
  return loadSeedData();
}

/**
 * Get a package by ID from seed data
 */
export async function getSeedPackageById(packageId: string): Promise<Package | null> {
  const packages = await loadSeedData();
  return packages.find((p) => p.packageId === packageId) || null;
}

/**
 * Get packages by IDs from seed data
 */
export async function getSeedPackagesByIds(packageIds: string[]): Promise<Package[]> {
  const packages = await loadSeedData();
  const idSet = new Set(packageIds);
  return packages.filter((p) => idSet.has(p.packageId));
}

/**
 * List packages with pagination and filtering
 */
export async function listSeedPackages(options: {
  category?: string;
  limit?: number;
  offset?: number;
  sort?: 'downloads' | 'rating' | 'recent';
  search?: string;
}): Promise<{ packages: Package[]; total: number }> {
  let packages = await loadSeedData();

  // Filter by category
  if (options.category) {
    packages = packages.filter((p) => p.category === options.category);
  }

  // Filter by search
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    packages = packages.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.packageId.toLowerCase().includes(searchLower) ||
        p.shortDescription?.toLowerCase().includes(searchLower) ||
        p.tags?.some((t) => t.toLowerCase().includes(searchLower))
    );
  }

  // Sort
  switch (options.sort) {
    case 'downloads':
      packages = packages.sort(
        (a, b) => (b.stats?.totalDownloads || 0) - (a.stats?.totalDownloads || 0)
      );
      break;
    case 'rating':
      packages = packages.sort(
        (a, b) => (b.stats?.averageRating || 0) - (a.stats?.averageRating || 0)
      );
      break;
    case 'recent':
    default:
      packages = packages.sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      break;
  }

  const total = packages.length;
  const offset = options.offset || 0;
  const limit = options.limit || 20;

  return {
    packages: packages.slice(offset, offset + limit),
    total,
  };
}

/**
 * Get featured packages from seed data
 */
export async function getFeaturedSeedPackages(limit: number = 10): Promise<Package[]> {
  const packages = await loadSeedData();

  // Consider "official" or "verified" packages as featured
  const featured = packages.filter(
    (p) => p.verificationStatus === 'official' || p.verificationStatus === 'verified'
  );

  if (featured.length >= limit) {
    return featured.slice(0, limit);
  }

  // Fill with highest downloaded packages
  const remaining = packages
    .filter((p) => !featured.includes(p))
    .sort((a, b) => (b.stats?.totalDownloads || 0) - (a.stats?.totalDownloads || 0));

  return [...featured, ...remaining].slice(0, limit);
}

/**
 * Get popular packages from seed data
 */
export async function getPopularSeedPackages(limit: number = 10): Promise<Package[]> {
  const packages = await loadSeedData();

  // Sort by downloads (simulate popularity)
  return packages
    .sort((a, b) => (b.stats?.totalDownloads || 0) - (a.stats?.totalDownloads || 0))
    .slice(0, limit);
}

/**
 * Get recent packages from seed data
 */
export async function getRecentSeedPackages(limit: number = 10): Promise<Package[]> {
  const packages = await loadSeedData();

  return packages
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    .slice(0, limit);
}

/**
 * Search packages in seed data
 */
export async function searchSeedPackages(
  query: string,
  options: { limit?: number; offset?: number; category?: string } = {}
): Promise<{ packages: Package[]; total: number }> {
  return listSeedPackages({
    search: query,
    category: options.category,
    limit: options.limit || 20,
    offset: options.offset || 0,
  });
}

/**
 * Get package versions (mock - returns single version based on latestVersion)
 */
export async function getSeedPackageVersions(packageId: string): Promise<PackageVersion[]> {
  const pkg = await getSeedPackageById(packageId);
  if (!pkg) return [];

  // Create a mock version from the package data
  const version: PackageVersion = {
    packageId: pkg.packageId,
    version: pkg.latestVersion || '0.0.0',
    semverMajor: 0,
    semverMinor: 0,
    semverPatch: 0,
    distribution: {
      tarball: `https://registry.npmjs.org/${pkg.packageId}/-/${pkg.packageId.split('/').pop()}-${pkg.latestVersion}.tgz`,
      shasum: '',
      integrity: '',
      size: 0,
      unpackedSize: 0,
    },
    dependencies: {},
    runtime: {},
    mcpManifest: {
      version: pkg.mcpVersion || '1.0',
      name: pkg.name,
      description: pkg.shortDescription || '',
    },
    publishedBy: pkg.publisherId,
    publishedAt: pkg.publishedAt || pkg.createdAt,
    deprecated: false,
    yanked: false,
    vulnerabilities: {
      severity: 'none',
      count: 0,
    },
    downloads: 0,
  };

  return [version];
}

/**
 * Check if we should use seed data (DynamoDB unavailable)
 */
export function shouldUseSeedData(): boolean {
  // Use seed data in development when no DYNAMODB_ENDPOINT is set
  // or when explicitly enabled via env var
  return process.env['USE_SEED_DATA'] === 'true' ||
    (process.env['NODE_ENV'] === 'development' && !process.env['DYNAMODB_ENDPOINT']);
}

/**
 * Get all unique categories from seed data
 */
export async function getSeedCategories(): Promise<string[]> {
  const packages = await loadSeedData();
  const categories = new Set(packages.map((p) => p.category).filter(Boolean));
  return Array.from(categories).sort();
}

/**
 * Get packages by category from seed data
 */
export async function getSeedPackagesByCategory(
  category: string,
  limit: number = 20
): Promise<Package[]> {
  const packages = await loadSeedData();
  return packages.filter((p) => p.category === category).slice(0, limit);
}

/**
 * Get packages by publisher from seed data
 */
export async function getSeedPackagesByPublisher(
  publisherId: string,
  limit: number = 50
): Promise<Package[]> {
  const packages = await loadSeedData();
  return packages.filter((p) => p.publisherId === publisherId).slice(0, limit);
}
