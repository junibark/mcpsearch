import { v4 as uuid } from 'uuid';
import * as semver from 'semver';
import type { Package, PackageVersion, CreatePackageInput } from '@mcpsearch/shared';
import {
  getItem,
  putItem,
  updateItem,
  query,
  queryAll,
  batchGet,
  transactWrite,
  buildUpdateExpression,
  encodeLastKey,
  decodeLastKey,
} from '../lib/aws/dynamodb.js';
import { logger } from '../lib/logger.js';

// =============================================================================
// Key Helpers
// =============================================================================

function packageKey(packageId: string) {
  return {
    PK: `PKG#${packageId}`,
    SK: 'META',
  };
}

function versionKey(packageId: string, version: string) {
  return {
    PK: `PKG#${packageId}`,
    SK: `VERSION#${version}`,
  };
}

function publisherPackageKey(publisherId: string, packageId: string) {
  return {
    PK: `PUBLISHER#${publisherId}`,
    SK: `PKG#${packageId}`,
  };
}

// =============================================================================
// Package Entity
// =============================================================================

interface PackageEntity extends Package {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK?: string;
  GSI2SK?: string;
}

interface VersionEntity extends PackageVersion {
  PK: string;
  SK: string;
}

// =============================================================================
// Repository Interface
// =============================================================================

export interface ListPackagesOptions {
  category?: string;
  publisherId?: string;
  status?: string;
  limit?: number;
  cursor?: string;
  sort?: 'downloads' | 'rating' | 'recent';
}

export interface ListPackagesResult {
  packages: Package[];
  nextCursor?: string;
  total?: number;
}

// =============================================================================
// Package Repository
// =============================================================================

export class PackageRepository {
  // ===========================================================================
  // Get Operations
  // ===========================================================================

  async getById(packageId: string): Promise<Package | null> {
    const entity = await getItem<PackageEntity>(packageKey(packageId));
    if (!entity) return null;
    return this.toPackage(entity);
  }

  async getByIds(packageIds: string[]): Promise<Package[]> {
    if (packageIds.length === 0) return [];

    const keys = packageIds.map((id) => packageKey(id));
    const entities = await batchGet<PackageEntity>(keys);
    return entities.map((e) => this.toPackage(e));
  }

  async getVersion(
    packageId: string,
    version: string
  ): Promise<PackageVersion | null> {
    const entity = await getItem<VersionEntity>(versionKey(packageId, version));
    if (!entity) return null;
    return this.toVersion(entity);
  }

  async getVersions(packageId: string): Promise<PackageVersion[]> {
    const result = await query<VersionEntity>({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `PKG#${packageId}`,
        ':sk': 'VERSION#',
      },
    });

    return result.items
      .map((e) => this.toVersion(e))
      .sort((a, b) => semver.rcompare(a.version, b.version));
  }

  async getLatestVersion(packageId: string): Promise<PackageVersion | null> {
    const pkg = await this.getById(packageId);
    if (!pkg?.latestVersion) return null;
    return this.getVersion(packageId, pkg.latestVersion);
  }

  // ===========================================================================
  // List Operations
  // ===========================================================================

  async list(options: ListPackagesOptions = {}): Promise<ListPackagesResult> {
    const { category, publisherId, status = 'published', limit = 20, cursor } = options;

    const exclusiveStartKey = decodeLastKey(cursor);

    // Query by publisher
    if (publisherId) {
      const result = await query<PackageEntity>({
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `PUBLISHER#${publisherId}`,
          ':status': status,
        },
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      });

      return {
        packages: result.items.map((e) => this.toPackage(e)),
        nextCursor: encodeLastKey(result.lastKey),
      };
    }

    // Query by category
    if (category) {
      const result = await query<PackageEntity>({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `CATEGORY#${category}`,
          ':status': status,
        },
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      });

      return {
        packages: result.items.map((e) => this.toPackage(e)),
        nextCursor: encodeLastKey(result.lastKey),
      };
    }

    // Query all published packages
    const result = await query<PackageEntity>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'PACKAGES',
      },
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false, // Most recent first
    });

    return {
      packages: result.items.map((e) => this.toPackage(e)),
      nextCursor: encodeLastKey(result.lastKey),
    };
  }

  async listByPublisher(
    publisherId: string,
    limit: number = 50
  ): Promise<Package[]> {
    const result = await query<PackageEntity>({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `PUBLISHER#${publisherId}`,
      },
      Limit: limit,
    });

    return result.items.map((e) => this.toPackage(e));
  }

  async listFeatured(limit: number = 10): Promise<Package[]> {
    // Featured packages are tagged with a special GSI
    const result = await query<PackageEntity>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': 'FEATURED',
        ':status': 'published',
      },
      Limit: limit,
    });

    return result.items.map((e) => this.toPackage(e));
  }

  async listPopular(limit: number = 10): Promise<Package[]> {
    const result = await query<PackageEntity>({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'PACKAGES',
      },
      Limit: limit,
      ScanIndexForward: false,
    });

    // Sort by downloads (in real implementation, use a sorted index)
    return result.items
      .map((e) => this.toPackage(e))
      .sort((a, b) => (b.stats?.totalDownloads || 0) - (a.stats?.totalDownloads || 0))
      .slice(0, limit);
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  async create(
    input: CreatePackageInput,
    publisherId: string
  ): Promise<Package> {
    const now = new Date().toISOString();
    const packageId = input.packageId;

    // Check if package already exists
    const existing = await this.getById(packageId);
    if (existing) {
      throw new Error(`Package ${packageId} already exists`);
    }

    const pkg: PackageEntity = {
      PK: `PKG#${packageId}`,
      SK: 'META',
      GSI1PK: 'PACKAGES',
      GSI1SK: now,
      GSI2PK: `PUBLISHER#${publisherId}`,
      GSI2SK: packageId,

      packageId,
      name: input.name,
      description: input.description,
      publisherId,
      category: input.category,
      tags: input.tags || [],
      capabilities: [],
      compatibleTools: {
        claudeCode: true,
        cursor: true,
        windsurf: true,
        continueDev: true,
      },
      repository: input.repository,
      homepage: input.homepage,
      documentation: input.documentation,
      license: input.license,
      keywords: input.keywords || [],
      mcpVersion: '',
      latestVersion: '',
      status: 'pending',
      verificationStatus: 'unverified',
      stats: {
        totalDownloads: 0,
        weeklyDownloads: 0,
        monthlyDownloads: 0,
        stars: 0,
        averageRating: 0,
        reviewCount: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    await putItem({ Item: pkg });

    logger.info({ packageId, publisherId }, 'Package created');
    return this.toPackage(pkg);
  }

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  async update(
    packageId: string,
    updates: Partial<Package>
  ): Promise<Package | null> {
    const now = new Date().toISOString();

    const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
      buildUpdateExpression({
        ...updates,
        updatedAt: now,
      });

    const result = await updateItem({
      Key: packageKey(packageId),
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    if (!result) return null;
    return this.toPackage(result as PackageEntity);
  }

  async publishVersion(
    packageId: string,
    versionInput: Omit<PackageVersion, 'packageId' | 'createdAt' | 'status'>
  ): Promise<PackageVersion> {
    const now = new Date().toISOString();
    const version = versionInput.version;

    // Validate semver
    if (!semver.valid(version)) {
      throw new Error(`Invalid version: ${version}`);
    }

    // Check version doesn't already exist
    const existing = await this.getVersion(packageId, version);
    if (existing) {
      throw new Error(`Version ${version} already exists`);
    }

    const versionEntity: VersionEntity = {
      PK: `PKG#${packageId}`,
      SK: `VERSION#${version}`,
      packageId,
      version,
      changelog: versionInput.changelog,
      mcpVersion: versionInput.mcpVersion,
      capabilities: versionInput.capabilities,
      compatibleTools: versionInput.compatibleTools,
      dependencies: versionInput.dependencies,
      peerDependencies: versionInput.peerDependencies,
      s3Key: versionInput.s3Key,
      size: versionInput.size,
      checksum: versionInput.checksum,
      status: 'pending',
      createdAt: now,
    };

    // Transaction: create version + update package latestVersion
    await transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: process.env.DYNAMODB_TABLE_NAME || 'mcp-search-main',
            Item: versionEntity,
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        {
          Update: {
            TableName: process.env.DYNAMODB_TABLE_NAME || 'mcp-search-main',
            Key: packageKey(packageId),
            UpdateExpression:
              'SET latestVersion = :version, mcpVersion = :mcpVersion, capabilities = :capabilities, updatedAt = :now',
            ExpressionAttributeValues: {
              ':version': version,
              ':mcpVersion': versionInput.mcpVersion,
              ':capabilities': versionInput.capabilities,
              ':now': now,
            },
          },
        },
      ],
    });

    logger.info({ packageId, version }, 'Version published');
    return this.toVersion(versionEntity);
  }

  async updateVersionStatus(
    packageId: string,
    version: string,
    status: 'pending' | 'published' | 'yanked'
  ): Promise<void> {
    await updateItem({
      Key: versionKey(packageId, version),
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': status },
    });
  }

  async incrementDownloads(packageId: string): Promise<void> {
    try {
      await updateItem({
        Key: packageKey(packageId),
        UpdateExpression:
          'SET stats.totalDownloads = if_not_exists(stats.totalDownloads, :zero) + :one, stats.weeklyDownloads = if_not_exists(stats.weeklyDownloads, :zero) + :one',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
        },
      });
    } catch (error) {
      logger.error({ error, packageId }, 'Failed to increment downloads');
    }
  }

  // ===========================================================================
  // Delete Operations
  // ===========================================================================

  async deprecate(packageId: string): Promise<void> {
    await updateItem({
      Key: packageKey(packageId),
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'deprecated',
        ':now': new Date().toISOString(),
      },
    });

    logger.info({ packageId }, 'Package deprecated');
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private toPackage(entity: PackageEntity): Package {
    const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...pkg } = entity;
    return pkg;
  }

  private toVersion(entity: VersionEntity): PackageVersion {
    const { PK, SK, ...version } = entity;
    return version;
  }
}

// Export singleton
export const packageRepository = new PackageRepository();
