/**
 * API Types
 *
 * Type definitions for API requests and responses.
 */

import type { Package, PackageListItem, PackageSearchResult, PackageVersion } from './package.js';
import type { PublicUserProfile, User } from './user.js';
import type { Review, ReviewListItem, ReviewSummary } from './review.js';
import type { PackageAnalytics, TrendingPackage, DashboardStats } from './analytics.js';

// ============================================
// Common Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  duration?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  pagination: {
    cursor?: string;
    limit: number;
    hasMore: boolean;
  };
}

// ============================================
// Package Endpoints
// ============================================

export interface ListPackagesParams {
  page?: number;
  limit?: number;
  category?: string;
  tool?: string;
  sort?: 'downloads' | 'recent' | 'rating' | 'name';
  order?: 'asc' | 'desc';
}

export type ListPackagesResponse = PaginatedResponse<PackageListItem>;

export interface GetPackageResponse {
  package: Package;
  versions: Array<{
    version: string;
    publishedAt: string;
    downloads: number;
  }>;
  readme: string;
  reviewSummary: ReviewSummary;
}

export interface GetVersionsParams {
  page?: number;
  limit?: number;
}

export type GetVersionsResponse = PaginatedResponse<PackageVersion>;

export interface PublishPackageRequest {
  name: string;
  version: string;
  description: string;
  shortDescription: string;
  category: string;
  tags: string[];
  license: string;
  repository?: {
    type: 'github' | 'gitlab' | 'bitbucket';
    url: string;
  };
  readme: string;
  mcpManifest: {
    version: string;
    name: string;
    description: string;
    tools?: Array<{ name: string; description: string }>;
    resources?: Array<{ uri: string; name: string }>;
    prompts?: Array<{ name: string; description?: string }>;
  };
}

export interface PublishPackageResponse {
  packageId: string;
  version: string;
  uploadUrl: string;
  uploadFields: Record<string, string>;
}

export interface UpdatePackageRequest {
  description?: string;
  shortDescription?: string;
  category?: string;
  tags?: string[];
  homepage?: string;
  documentation?: string;
  changelog?: string;
}

// ============================================
// Search Endpoints
// ============================================

export interface SearchParams {
  q: string;
  category?: string;
  tool?: string;
  license?: string;
  minRating?: number;
  page?: number;
  limit?: number;
  sort?: 'relevance' | 'downloads' | 'recent' | 'rating';
}

export interface SearchResponse {
  results: PackageSearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  facets: {
    categories: Array<{ value: string; count: number }>;
    tools: Array<{ value: string; count: number }>;
    licenses: Array<{ value: string; count: number }>;
  };
  queryTime: number;
}

export interface SuggestParams {
  q: string;
  limit?: number;
}

export interface SuggestResponse {
  suggestions: Array<{
    text: string;
    type: 'package' | 'tag' | 'category';
    packageId?: string;
  }>;
}

// ============================================
// User Endpoints
// ============================================

export interface GetUserResponse {
  user: User;
}

export interface GetPublicUserResponse {
  user: PublicUserProfile;
  packages: PackageListItem[];
}

export interface UpdateUserRequest {
  displayName?: string;
  bio?: string;
  location?: string;
  company?: string;
  socialLinks?: {
    github?: string;
    twitter?: string;
    linkedin?: string;
    website?: string;
  };
  preferences?: {
    emailNotifications?: boolean;
    weeklyDigest?: boolean;
    securityAlerts?: boolean;
    theme?: 'light' | 'dark' | 'system';
  };
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  keyId: string;
  apiKey: string; // Only shown once
  name: string;
  scopes: string[];
  createdAt: string;
  expiresAt?: string;
}

// ============================================
// Review Endpoints
// ============================================

export interface GetReviewsParams {
  page?: number;
  limit?: number;
  sort?: 'recent' | 'helpful' | 'rating';
  rating?: number;
}

export type GetReviewsResponse = PaginatedResponse<ReviewListItem>;

export interface CreateReviewRequest {
  rating: number;
  title?: string;
  body: string;
  versionReviewed: string;
  toolUsed?: string;
}

export interface CreateReviewResponse {
  review: Review;
}

export interface UpdateReviewRequest {
  rating?: number;
  title?: string;
  body?: string;
}

export interface RespondToReviewRequest {
  body: string;
}

// ============================================
// Analytics Endpoints
// ============================================

export interface GetAnalyticsParams {
  startDate: string;
  endDate: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface GetAnalyticsResponse {
  analytics: PackageAnalytics;
}

export interface GetTrendingParams {
  timeRange: '24h' | '7d' | '30d';
  limit?: number;
}

export interface GetTrendingResponse {
  packages: TrendingPackage[];
  timeRange: string;
  computedAt: string;
}

export interface GetDashboardStatsResponse {
  stats: DashboardStats;
  computedAt: string;
}

// ============================================
// CLI Endpoints
// ============================================

export interface ResolvePackagesRequest {
  packages: Array<{
    name: string;
    version?: string;
  }>;
  tool: string;
}

export interface ResolvePackagesResponse {
  resolved: Array<{
    packageId: string;
    version: string;
    downloadUrl: string;
    integrity: string;
    dependencies: Array<{
      packageId: string;
      version: string;
    }>;
  }>;
}

export interface CheckUpdatesRequest {
  packages: Array<{
    packageId: string;
    currentVersion: string;
  }>;
}

export interface CheckUpdatesResponse {
  updates: Array<{
    packageId: string;
    currentVersion: string;
    latestVersion: string;
    updateType: 'major' | 'minor' | 'patch';
    changelog?: string;
  }>;
}

export interface CLIVersionCheckResponse {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl?: string;
  releaseNotes?: string;
  breaking?: boolean;
}

// ============================================
// Auth Endpoints
// ============================================

export interface TokenExchangeRequest {
  cognitoToken: string;
}

export interface TokenExchangeResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

// ============================================
// Categories
// ============================================

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  packageCount: number;
  subcategories?: Array<{
    id: string;
    name: string;
    packageCount: number;
  }>;
}

export interface GetCategoriesResponse {
  categories: Category[];
}
