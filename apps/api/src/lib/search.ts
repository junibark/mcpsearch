import { Client } from '@opensearch-project/opensearch';
import { config } from './config.js';
import { logger } from './logger.js';
import type { Package } from '@mcpsearch/shared';

// =============================================================================
// Client Setup
// =============================================================================

let searchClient: Client | null = null;

export function getSearchClient(): Client | null {
  if (!searchClient && config.opensearch.endpoint) {
    try {
      searchClient = new Client({
        node: config.opensearch.endpoint,
        ssl: {
          rejectUnauthorized: config.env === 'production',
        },
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to create OpenSearch client');
    }
  }
  return searchClient;
}

// =============================================================================
// Index Configuration
// =============================================================================

export const PACKAGES_INDEX = config.opensearch.index;

export const packagesIndexMapping = {
  settings: {
    number_of_shards: 2,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        package_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding', 'package_edge_ngram'],
        },
        package_search: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding'],
        },
      },
      filter: {
        package_edge_ngram: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 20,
        },
      },
    },
  },
  mappings: {
    properties: {
      packageId: { type: 'keyword' },
      name: {
        type: 'text',
        analyzer: 'package_analyzer',
        search_analyzer: 'package_search',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      description: {
        type: 'text',
        analyzer: 'standard',
      },
      publisherId: { type: 'keyword' },
      publisherName: { type: 'keyword' },
      category: { type: 'keyword' },
      tags: { type: 'keyword' },
      capabilities: { type: 'keyword' },
      compatibleTools: {
        properties: {
          claudeCode: { type: 'boolean' },
          cursor: { type: 'boolean' },
          windsurf: { type: 'boolean' },
          continueDev: { type: 'boolean' },
        },
      },
      latestVersion: { type: 'keyword' },
      mcpVersion: { type: 'keyword' },
      license: { type: 'keyword' },
      status: { type: 'keyword' },
      verificationStatus: { type: 'keyword' },
      stats: {
        properties: {
          totalDownloads: { type: 'long' },
          weeklyDownloads: { type: 'long' },
          stars: { type: 'integer' },
          averageRating: { type: 'float' },
          reviewCount: { type: 'integer' },
        },
      },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },
  },
};

// =============================================================================
// Search Types
// =============================================================================

export interface SearchOptions {
  query?: string;
  category?: string;
  tool?: string;
  tags?: string[];
  capabilities?: string[];
  verificationStatus?: string;
  page?: number;
  limit?: number;
  sort?: 'relevance' | 'downloads' | 'rating' | 'recent';
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SuggestResult {
  text: string;
  score: number;
  packageId: string;
}

// =============================================================================
// Index Management
// =============================================================================

export async function createPackagesIndex(): Promise<void> {
  const client = getSearchClient();
  if (!client) {
    logger.warn('OpenSearch client not available');
    return;
  }

  try {
    const exists = await client.indices.exists({ index: PACKAGES_INDEX });
    if (!exists.body) {
      await client.indices.create({
        index: PACKAGES_INDEX,
        body: packagesIndexMapping,
      });
      logger.info({ index: PACKAGES_INDEX }, 'Created OpenSearch index');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to create OpenSearch index');
    throw error;
  }
}

// =============================================================================
// Indexing Operations
// =============================================================================

export async function indexPackage(pkg: Package): Promise<void> {
  const client = getSearchClient();
  if (!client) return;

  try {
    await client.index({
      index: PACKAGES_INDEX,
      id: pkg.packageId,
      body: {
        packageId: pkg.packageId,
        name: pkg.name,
        description: pkg.description,
        publisherId: pkg.publisherId,
        category: pkg.category,
        tags: pkg.tags,
        capabilities: pkg.capabilities,
        compatibleTools: pkg.compatibleTools,
        latestVersion: pkg.latestVersion,
        mcpVersion: pkg.mcpVersion,
        license: pkg.license,
        status: pkg.status,
        verificationStatus: pkg.verificationStatus,
        stats: pkg.stats,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      },
      refresh: true,
    });
    logger.debug({ packageId: pkg.packageId }, 'Indexed package');
  } catch (error) {
    logger.error({ error, packageId: pkg.packageId }, 'Failed to index package');
    throw error;
  }
}

export async function removePackageFromIndex(packageId: string): Promise<void> {
  const client = getSearchClient();
  if (!client) return;

  try {
    await client.delete({
      index: PACKAGES_INDEX,
      id: packageId,
      refresh: true,
    });
    logger.debug({ packageId }, 'Removed package from index');
  } catch (error) {
    logger.error({ error, packageId }, 'Failed to remove package from index');
    throw error;
  }
}

export async function bulkIndexPackages(packages: Package[]): Promise<void> {
  const client = getSearchClient();
  if (!client || packages.length === 0) return;

  try {
    const body = packages.flatMap((pkg) => [
      { index: { _index: PACKAGES_INDEX, _id: pkg.packageId } },
      {
        packageId: pkg.packageId,
        name: pkg.name,
        description: pkg.description,
        publisherId: pkg.publisherId,
        category: pkg.category,
        tags: pkg.tags,
        capabilities: pkg.capabilities,
        compatibleTools: pkg.compatibleTools,
        latestVersion: pkg.latestVersion,
        mcpVersion: pkg.mcpVersion,
        license: pkg.license,
        status: pkg.status,
        verificationStatus: pkg.verificationStatus,
        stats: pkg.stats,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      },
    ]);

    const result = await client.bulk({ body, refresh: true });
    if (result.body.errors) {
      logger.error({ errors: result.body.items }, 'Bulk index errors');
    }
    logger.info({ count: packages.length }, 'Bulk indexed packages');
  } catch (error) {
    logger.error({ error }, 'Failed to bulk index packages');
    throw error;
  }
}

// =============================================================================
// Search Operations
// =============================================================================

export async function searchPackages(
  options: SearchOptions
): Promise<SearchResult<Package>> {
  const client = getSearchClient();
  const {
    query,
    category,
    tool,
    tags,
    capabilities,
    verificationStatus,
    page = 1,
    limit = 20,
    sort = 'relevance',
  } = options;

  // Fallback if OpenSearch not available
  if (!client) {
    return { items: [], total: 0, page, limit, totalPages: 0 };
  }

  try {
    const must: unknown[] = [];
    const filter: unknown[] = [];

    // Text search
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['name^3', 'description', 'tags^2', 'packageId'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Filters
    filter.push({ term: { status: 'published' } });

    if (category) {
      filter.push({ term: { category } });
    }

    if (tool) {
      filter.push({ term: { [`compatibleTools.${tool}`]: true } });
    }

    if (tags && tags.length > 0) {
      filter.push({ terms: { tags } });
    }

    if (capabilities && capabilities.length > 0) {
      filter.push({ terms: { capabilities } });
    }

    if (verificationStatus) {
      filter.push({ term: { verificationStatus } });
    }

    // Build sort
    const sortConfig = buildSortConfig(sort, !!query);

    // Execute search
    const result = await client.search({
      index: PACKAGES_INDEX,
      body: {
        from: (page - 1) * limit,
        size: limit,
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter,
          },
        },
        sort: sortConfig,
      },
    });

    const hits = result.body.hits;
    const total = typeof hits.total === 'number' ? hits.total : hits.total.value;

    return {
      items: hits.hits.map((hit: { _source: Package }) => hit._source),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error({ error, options }, 'Search failed');
    return { items: [], total: 0, page, limit, totalPages: 0 };
  }
}

function buildSortConfig(
  sort: string,
  hasQuery: boolean
): Array<Record<string, unknown>> {
  switch (sort) {
    case 'downloads':
      return [{ 'stats.totalDownloads': { order: 'desc' } }];
    case 'rating':
      return [{ 'stats.averageRating': { order: 'desc' } }];
    case 'recent':
      return [{ updatedAt: { order: 'desc' } }];
    case 'relevance':
    default:
      return hasQuery
        ? [{ _score: { order: 'desc' } }, { 'stats.totalDownloads': { order: 'desc' } }]
        : [{ 'stats.totalDownloads': { order: 'desc' } }];
  }
}

// =============================================================================
// Autocomplete / Suggestions
// =============================================================================

export async function getSuggestions(
  prefix: string,
  limit: number = 10
): Promise<SuggestResult[]> {
  const client = getSearchClient();
  if (!client || !prefix || prefix.length < 2) {
    return [];
  }

  try {
    const result = await client.search({
      index: PACKAGES_INDEX,
      body: {
        size: limit,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: prefix,
                  fields: ['name^3', 'packageId', 'tags'],
                  type: 'phrase_prefix',
                },
              },
            ],
            filter: [{ term: { status: 'published' } }],
          },
        },
        _source: ['packageId', 'name'],
        sort: [{ 'stats.totalDownloads': { order: 'desc' } }],
      },
    });

    return result.body.hits.hits.map(
      (hit: { _source: { packageId: string; name: string }; _score: number }) => ({
        text: hit._source.name,
        packageId: hit._source.packageId,
        score: hit._score,
      })
    );
  } catch (error) {
    logger.error({ error, prefix }, 'Suggestions failed');
    return [];
  }
}

// =============================================================================
// Aggregations
// =============================================================================

export async function getCategoryFacets(): Promise<
  Array<{ category: string; count: number }>
> {
  const client = getSearchClient();
  if (!client) return [];

  try {
    const result = await client.search({
      index: PACKAGES_INDEX,
      body: {
        size: 0,
        query: { term: { status: 'published' } },
        aggs: {
          categories: {
            terms: { field: 'category', size: 50 },
          },
        },
      },
    });

    return result.body.aggregations.categories.buckets.map(
      (bucket: { key: string; doc_count: number }) => ({
        category: bucket.key,
        count: bucket.doc_count,
      })
    );
  } catch (error) {
    logger.error({ error }, 'Category facets failed');
    return [];
  }
}

// =============================================================================
// Health Check
// =============================================================================

export async function checkSearchHealth(): Promise<{
  status: 'ok' | 'error' | 'disconnected';
  latencyMs?: number;
}> {
  const client = getSearchClient();
  if (!client) {
    return { status: 'disconnected' };
  }

  try {
    const start = Date.now();
    await client.cluster.health();
    const latencyMs = Date.now() - start;
    return { status: 'ok', latencyMs };
  } catch (error) {
    return { status: 'error' };
  }
}
