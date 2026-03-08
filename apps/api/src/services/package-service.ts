/**
 * Package Service
 *
 * Business logic for package operations.
 */

import type {
  Package,
  PackageVersion,
  CreatePackageInput,
  PublishVersionInput,
} from '@mcpsearch/shared';
import { packageRepository, type ListPackagesOptions } from '../repositories/package-repository.js';
import {
  getPackageUploadUrl,
  getPackageDownloadUrl,
  objectExists,
  PACKAGES_BUCKET,
} from '../lib/aws/s3.js';
import {
  cacheGet,
  cacheSet,
  cacheGetOrSet,
  CacheKeys,
  CacheTTL,
  invalidatePackageCache,
} from '../lib/cache.js';
import {
  searchPackages,
  indexPackage,
  getSuggestions,
  type SearchOptions,
  type SearchResult,
} from '../lib/search.js';
import { logger } from '../lib/logger.js';
import * as seedData from '../lib/seed-data.js';

// =============================================================================
// Package Service
// =============================================================================

export class PackageService {
  // ===========================================================================
  // Get Operations
  // ===========================================================================

  async getById(packageId: string): Promise<Package | null> {
    // Try seed data first in development mode
    if (seedData.shouldUseSeedData()) {
      return seedData.getSeedPackageById(packageId);
    }

    try {
      return await cacheGetOrSet(
        CacheKeys.package(packageId),
        () => packageRepository.getById(packageId),
        CacheTTL.PACKAGE
      );
    } catch (error) {
      logger.warn({ error, packageId }, 'DynamoDB unavailable, falling back to seed data');
      return seedData.getSeedPackageById(packageId);
    }
  }

  async getByIds(packageIds: string[]): Promise<Package[]> {
    // Try to get from cache first
    const cached: Package[] = [];
    const uncachedIds: string[] = [];

    await Promise.all(
      packageIds.map(async (id) => {
        const pkg = await cacheGet<Package>(CacheKeys.package(id));
        if (pkg) {
          cached.push(pkg);
        } else {
          uncachedIds.push(id);
        }
      })
    );

    // Fetch uncached from database
    if (uncachedIds.length > 0) {
      const fromDb = await packageRepository.getByIds(uncachedIds);

      // Cache the results
      await Promise.all(
        fromDb.map((pkg) =>
          cacheSet(CacheKeys.package(pkg.packageId), pkg, CacheTTL.PACKAGE)
        )
      );

      cached.push(...fromDb);
    }

    // Return in original order
    const pkgMap = new Map(cached.map((p) => [p.packageId, p]));
    return packageIds.map((id) => pkgMap.get(id)!).filter(Boolean);
  }

  async getVersion(
    packageId: string,
    version: string
  ): Promise<PackageVersion | null> {
    return cacheGetOrSet(
      CacheKeys.packageVersion(packageId, version),
      () => packageRepository.getVersion(packageId, version),
      CacheTTL.PACKAGE
    );
  }

  async getVersions(packageId: string): Promise<PackageVersion[]> {
    if (seedData.shouldUseSeedData()) {
      return seedData.getSeedPackageVersions(packageId);
    }

    try {
      return await cacheGetOrSet(
        CacheKeys.packageVersions(packageId),
        () => packageRepository.getVersions(packageId),
        CacheTTL.PACKAGE
      );
    } catch (error) {
      logger.warn({ error, packageId }, 'DynamoDB unavailable, falling back to seed data');
      return seedData.getSeedPackageVersions(packageId);
    }
  }

  async getLatestVersion(packageId: string): Promise<PackageVersion | null> {
    const pkg = await this.getById(packageId);
    if (!pkg?.latestVersion) return null;
    return this.getVersion(packageId, pkg.latestVersion);
  }

  // ===========================================================================
  // List Operations
  // ===========================================================================

  async list(options: ListPackagesOptions = {}) {
    if (seedData.shouldUseSeedData()) {
      const result = await seedData.listSeedPackages({
        category: options.category,
        limit: options.limit,
        sort: options.sort,
      });
      return {
        packages: result.packages,
        total: result.total,
        nextCursor: undefined,
      };
    }

    try {
      return await packageRepository.list(options);
    } catch (error) {
      logger.warn({ error }, 'DynamoDB unavailable, falling back to seed data');
      const result = await seedData.listSeedPackages({
        category: options.category,
        limit: options.limit,
        sort: options.sort,
      });
      return {
        packages: result.packages,
        total: result.total,
        nextCursor: undefined,
      };
    }
  }

  async listByPublisher(publisherId: string, options?: { limit?: number; offset?: number; sort?: string }): Promise<{ items: Package[]; total: number }> {
    if (seedData.shouldUseSeedData()) {
      const packages = await seedData.getSeedPackagesByPublisher(publisherId, options?.limit || 50);
      return { items: packages, total: packages.length };
    }

    try {
      const packages = await cacheGetOrSet(
        CacheKeys.userPackages(publisherId),
        () => packageRepository.listByPublisher(publisherId),
        CacheTTL.MEDIUM
      );
      return { items: packages, total: packages.length };
    } catch (error) {
      logger.warn({ error, publisherId }, 'DynamoDB unavailable, falling back to seed data');
      const packages = await seedData.getSeedPackagesByPublisher(publisherId, options?.limit || 50);
      return { items: packages, total: packages.length };
    }
  }

  async listFeatured(limit: number = 10): Promise<Package[]> {
    if (seedData.shouldUseSeedData()) {
      return seedData.getFeaturedSeedPackages(limit);
    }

    try {
      return await cacheGetOrSet(
        CacheKeys.featuredPackages(),
        () => packageRepository.listFeatured(limit),
        CacheTTL.FEATURED
      );
    } catch (error) {
      logger.warn({ error }, 'DynamoDB unavailable, falling back to seed data');
      return seedData.getFeaturedSeedPackages(limit);
    }
  }

  async listPopular(limit: number = 10): Promise<Package[]> {
    if (seedData.shouldUseSeedData()) {
      return seedData.getPopularSeedPackages(limit);
    }

    try {
      return await cacheGetOrSet(
        CacheKeys.popularPackages(),
        () => packageRepository.listPopular(limit),
        CacheTTL.FEATURED
      );
    } catch (error) {
      logger.warn({ error }, 'DynamoDB unavailable, falling back to seed data');
      return seedData.getPopularSeedPackages(limit);
    }
  }

  async listRecent(limit: number = 10): Promise<Package[]> {
    if (seedData.shouldUseSeedData()) {
      return seedData.getRecentSeedPackages(limit);
    }

    try {
      return await cacheGetOrSet(
        CacheKeys.recentPackages(),
        async () => {
          const result = await packageRepository.list({ limit, sort: 'recent' });
          return result.packages;
        },
        CacheTTL.SHORT
      );
    } catch (error) {
      logger.warn({ error }, 'DynamoDB unavailable, falling back to seed data');
      return seedData.getRecentSeedPackages(limit);
    }
  }

  // ===========================================================================
  // Search Operations
  // ===========================================================================

  async search(options: SearchOptions): Promise<SearchResult<Package>> {
    if (seedData.shouldUseSeedData()) {
      const result = await seedData.searchSeedPackages(options.query || '', {
        limit: options.limit,
        offset: options.offset,
        category: options.category,
      });
      return {
        items: result.packages,
        total: result.total,
        page: Math.floor((options.offset || 0) / (options.limit || 20)) + 1,
        pageSize: options.limit || 20,
        totalPages: Math.ceil(result.total / (options.limit || 20)),
      };
    }

    const cacheKey = CacheKeys.search(
      options.query || '',
      JSON.stringify({ ...options, query: undefined })
    );

    try {
      return await cacheGetOrSet(
        cacheKey,
        () => searchPackages(options),
        CacheTTL.SEARCH
      );
    } catch (error) {
      logger.warn({ error }, 'Search unavailable, falling back to seed data');
      const result = await seedData.searchSeedPackages(options.query || '', {
        limit: options.limit,
        offset: options.offset,
        category: options.category,
      });
      return {
        items: result.packages,
        total: result.total,
        page: Math.floor((options.offset || 0) / (options.limit || 20)) + 1,
        pageSize: options.limit || 20,
        totalPages: Math.ceil(result.total / (options.limit || 20)),
      };
    }
  }

  async suggest(prefix: string, limit: number = 10) {
    return cacheGetOrSet(
      CacheKeys.searchSuggest(prefix),
      () => getSuggestions(prefix, limit),
      CacheTTL.SEARCH
    );
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  async create(
    input: CreatePackageInput,
    publisherId: string
  ): Promise<Package> {
    const pkg = await packageRepository.create(input, publisherId);

    // Index in search
    await indexPackage(pkg).catch((err) => {
      logger.error({ err, packageId: pkg.packageId }, 'Failed to index package');
    });

    // Invalidate caches
    await invalidatePackageCache(pkg.packageId);

    return pkg;
  }

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  async update(
    packageId: string,
    updates: Partial<Package>,
    publisherId: string
  ): Promise<Package | null> {
    // Verify ownership
    const pkg = await this.getById(packageId);
    if (!pkg) return null;
    if (pkg.publisherId !== publisherId) {
      throw new Error('Unauthorized: You do not own this package');
    }

    const updated = await packageRepository.update(packageId, updates);
    if (!updated) return null;

    // Re-index in search
    await indexPackage(updated).catch((err) => {
      logger.error({ err, packageId }, 'Failed to re-index package');
    });

    // Invalidate cache
    await invalidatePackageCache(packageId);

    return updated;
  }

  // ===========================================================================
  // Version Operations
  // ===========================================================================

  async getUploadUrl(
    packageId: string,
    version: string,
    publisherId: string
  ): Promise<{ url: string; key: string }> {
    // Verify ownership
    const pkg = await this.getById(packageId);
    if (!pkg) {
      throw new Error('Package not found');
    }
    if (pkg.publisherId !== publisherId) {
      throw new Error('Unauthorized: You do not own this package');
    }

    // Check version doesn't already exist
    const existingVersion = await this.getVersion(packageId, version);
    if (existingVersion) {
      throw new Error(`Version ${version} already exists`);
    }

    return getPackageUploadUrl(packageId, version);
  }

  async publishVersion(
    packageId: string,
    input: PublishVersionInput,
    publisherId: string
  ): Promise<PackageVersion> {
    // Verify ownership
    const pkg = await this.getById(packageId);
    if (!pkg) {
      throw new Error('Package not found');
    }
    if (pkg.publisherId !== publisherId) {
      throw new Error('Unauthorized: You do not own this package');
    }

    // Verify package was uploaded to S3
    const s3Key = `packages/${packageId}/${input.version}/package.tgz`;
    const exists = await objectExists(PACKAGES_BUCKET, s3Key);
    if (!exists) {
      throw new Error('Package tarball not found. Please upload first.');
    }

    const version = await packageRepository.publishVersion(packageId, {
      version: input.version,
      changelog: input.changelog,
      mcpVersion: input.mcpVersion,
      capabilities: input.capabilities,
      compatibleTools: input.compatibleTools,
      dependencies: input.dependencies,
      peerDependencies: input.peerDependencies,
      s3Key,
      size: 0, // Will be updated by worker
      checksum: '', // Will be calculated by worker
    });

    // Update package status if first version
    if (pkg.status === 'pending') {
      await packageRepository.update(packageId, { status: 'published' });
    }

    // Invalidate caches
    await invalidatePackageCache(packageId);

    // Re-index with updated version info
    const updatedPkg = await packageRepository.getById(packageId);
    if (updatedPkg) {
      await indexPackage(updatedPkg).catch((err) => {
        logger.error({ err, packageId }, 'Failed to re-index package');
      });
    }

    logger.info({ packageId, version: input.version }, 'Version published');
    return version;
  }

  // ===========================================================================
  // Download Operations
  // ===========================================================================

  async getDownloadUrl(
    packageId: string,
    version?: string
  ): Promise<{ url: string; version: string }> {
    const pkg = await this.getById(packageId);
    if (!pkg) {
      throw new Error('Package not found');
    }

    const targetVersion = version || pkg.latestVersion;
    if (!targetVersion) {
      throw new Error('No version available');
    }

    const url = await getPackageDownloadUrl(packageId, targetVersion);

    // Increment download counter (fire and forget)
    packageRepository.incrementDownloads(packageId).catch(() => {});

    return { url, version: targetVersion };
  }

  // ===========================================================================
  // Deprecation
  // ===========================================================================

  async deprecate(packageId: string, publisherId: string): Promise<void> {
    // Verify ownership
    const pkg = await this.getById(packageId);
    if (!pkg) {
      throw new Error('Package not found');
    }
    if (pkg.publisherId !== publisherId) {
      throw new Error('Unauthorized: You do not own this package');
    }

    await packageRepository.deprecate(packageId);

    // Invalidate cache
    await invalidatePackageCache(packageId);

    logger.info({ packageId, publisherId }, 'Package deprecated');
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  async getStats(): Promise<{
    totalPackages: number;
    totalDownloads: number;
    publisherCount: number;
  }> {
    // This would typically be aggregated separately
    // For now, return placeholder
    return {
      totalPackages: 0,
      totalDownloads: 0,
      publisherCount: 0,
    };
  }
}

// Export singleton
export const packageService = new PackageService();
