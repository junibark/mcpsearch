/**
 * Registry Client
 *
 * HTTP client for MCPSearch API.
 */

import got, { type Got } from 'got';
import type { Package } from '@mcpsearch/shared';
import { ConfigManager } from './config-manager.js';

export interface SearchResult {
  results: Package[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PackageDetails {
  package: Package;
  versions?: Array<{
    version: string;
    publishedAt: string;
  }>;
}

export class RegistryClient {
  private client: Got;
  private config: ConfigManager;

  constructor() {
    this.config = new ConfigManager();
    const registryUrl = this.config.getRegistryUrl();

    this.client = got.extend({
      prefixUrl: registryUrl,
      headers: {
        'User-Agent': `mcp-cli/${process.env['npm_package_version'] ?? '0.1.0'}`,
      },
      timeout: {
        request: 30000,
      },
      retry: {
        limit: 2,
      },
    });
  }

  /**
   * Search for packages
   */
  async search(params: {
    q?: string;
    category?: string;
    tool?: string;
    sort?: string;
    limit?: number;
    page?: number;
  }): Promise<SearchResult> {
    const searchParams = new URLSearchParams();

    if (params.q) searchParams.set('q', params.q);
    if (params.category) searchParams.set('category', params.category);
    if (params.tool) searchParams.set('tool', params.tool);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.page) searchParams.set('page', params.page.toString());

    const response = await this.client.get('v1/search', {
      searchParams,
    }).json<{
      success: boolean;
      data: {
        packages: Package[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasMore: boolean;
        };
      };
    }>();

    // Map API response to expected format
    return {
      results: response.data.packages,
      pagination: response.data.pagination,
    };
  }

  /**
   * Get package details
   */
  async getPackage(packageId: string): Promise<PackageDetails | null> {
    try {
      const response = await this.client.get(`v1/packages/${encodeURIComponent(packageId)}`)
        .json<{ success: boolean; data: Package & { versions?: Array<{ version: string; publishedAt: string }> } }>();

      return {
        package: response.data,
        versions: response.data.versions,
      };
    } catch (error: unknown) {
      if ((error as { response?: { statusCode: number } }).response?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get package info by ID (for installation)
   */
  async getPackageInfo(packageId: string): Promise<Package | null> {
    const result = await this.getPackage(packageId);
    return result?.package ?? null;
  }
}
