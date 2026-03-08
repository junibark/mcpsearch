/**
 * User Types
 *
 * Type definitions for users and authentication.
 */

export type PublisherStatus = 'none' | 'pending' | 'approved' | 'suspended';
export type PublisherTier = 'free' | 'pro' | 'enterprise';
export type OrganizationRole = 'owner' | 'admin' | 'member';

export interface UserStats {
  packagesPublished: number;
  totalDownloads: number;
  followers: number;
  following: number;
}

export interface UserPreferences {
  emailNotifications: boolean;
  weeklyDigest: boolean;
  securityAlerts: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface SocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

export interface ApiKey {
  /** Unique key identifier */
  keyId: string;

  /** User-provided name for the key */
  name: string;

  /** First 8 characters for identification */
  prefix: string;

  /** Allowed scopes */
  scopes: ApiKeyScope[];

  /** Creation timestamp */
  createdAt: string;

  /** Last usage timestamp */
  lastUsedAt?: string;

  /** Expiration timestamp */
  expiresAt?: string;
}

export type ApiKeyScope =
  | 'read:packages'
  | 'write:packages'
  | 'read:profile'
  | 'write:profile'
  | 'read:analytics'
  | 'admin';

/**
 * Full user profile stored in DynamoDB
 */
export interface User {
  /** Unique user identifier */
  userId: string;

  /** Cognito subject ID */
  cognitoSub: string;

  /** Unique username */
  username: string;

  /** Email address */
  email: string;

  /** Whether email is verified */
  emailVerified: boolean;

  /** Display name */
  displayName: string;

  /** Avatar URL */
  avatar?: string;

  /** User bio (max 500 chars) */
  bio?: string;

  /** Location */
  location?: string;

  /** Company name */
  company?: string;

  /** Social media links */
  socialLinks: SocialLinks;

  /** Publisher status */
  publisherStatus: PublisherStatus;

  /** When publisher status was verified */
  publisherVerifiedAt?: string;

  /** Publisher tier */
  publisherTier: PublisherTier;

  /** Organization ID if member of org */
  organizationId?: string;

  /** Role within organization */
  organizationRole?: OrganizationRole;

  /** User statistics */
  stats: UserStats;

  /** User preferences */
  preferences: UserPreferences;

  /** API keys (stored separately, references only) */
  apiKeyCount: number;

  /** Account creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Last login timestamp */
  lastLoginAt?: string;
}

/**
 * Public user profile (safe to expose)
 */
export interface PublicUserProfile {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  location?: string;
  company?: string;
  socialLinks: SocialLinks;
  publisherStatus: PublisherStatus;
  publisherTier: PublisherTier;
  stats: Pick<UserStats, 'packagesPublished' | 'totalDownloads'>;
  createdAt: string;
}

/**
 * Organization entity
 */
export interface Organization {
  /** Unique organization identifier */
  organizationId: string;

  /** Organization name */
  name: string;

  /** URL-safe slug */
  slug: string;

  /** Description */
  description?: string;

  /** Logo URL */
  logo?: string;

  /** Website URL */
  website?: string;

  /** Verified organization */
  verified: boolean;

  /** Organization tier */
  tier: PublisherTier;

  /** Member count */
  memberCount: number;

  /** Package count */
  packageCount: number;

  /** Total downloads across all packages */
  totalDownloads: number;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Organization membership
 */
export interface OrganizationMember {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  addedAt: string;
  addedBy: string;
}

/**
 * Session information for authenticated requests
 */
export interface AuthSession {
  userId: string;
  username: string;
  email: string;
  scopes: ApiKeyScope[];
  organizationId?: string;
  organizationRole?: OrganizationRole;
  expiresAt: number;
}
