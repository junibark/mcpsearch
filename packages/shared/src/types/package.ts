/**
 * MCP Package Types
 *
 * Core type definitions for MCP packages in the registry.
 */

export type PackageStatus = 'pending' | 'published' | 'deprecated' | 'removed';
export type VerificationStatus = 'unverified' | 'verified' | 'official';
export type SecurityScanStatus = 'pending' | 'passed' | 'failed' | 'warning';
export type MCPCapability = 'tools' | 'resources' | 'prompts' | 'sampling';

export interface ToolCompatibility {
  supported: boolean;
  minVersion?: string;
  maxVersion?: string;
  installCommand?: string;
  configSnippet?: string;
  notes?: string;
}

export interface PackageCompatibility {
  claudeCode: ToolCompatibility;
  cursor: ToolCompatibility;
  windsurf: ToolCompatibility;
  continueDev: ToolCompatibility;
  custom?: Record<string, ToolCompatibility>;
}

export interface PackageStats {
  totalDownloads: number;
  weeklyDownloads: number;
  monthlyDownloads: number;
  stars: number;
  reviewCount: number;
  averageRating: number;
}

export interface PackageRepository {
  type: 'github' | 'gitlab' | 'bitbucket' | 'other';
  url: string;
  branch?: string;
  directory?: string;
}

export interface PackageAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface PackageRuntime {
  node?: string;
  python?: string;
  deno?: string;
  bun?: string;
}

/**
 * Core package metadata stored in DynamoDB
 */
export interface Package {
  /** Unique package identifier (e.g., "@anthropic/mcp-server-filesystem") */
  packageId: string;

  /** Display name for the package */
  name: string;

  /** Full description (supports markdown) */
  description: string;

  /** Short description for listings (max 150 chars) */
  shortDescription: string;

  /** Latest published version */
  latestVersion: string;

  /** Latest stable version (excludes prereleases) */
  latestStableVersion: string;

  /** Total number of published versions */
  versionCount: number;

  /** Publisher user ID */
  publisherId: string;

  /** Publisher display name (denormalized) */
  publisherName: string;

  /** Whether publisher is verified */
  publisherVerified: boolean;

  /** Optional organization ID */
  organizationId?: string;

  /** Primary category */
  category: string;

  /** Subcategory */
  subcategory?: string;

  /** Searchable tags */
  tags: string[];

  /** Tool compatibility information */
  compatibility: PackageCompatibility;

  /** Aggregated statistics */
  stats: PackageStats;

  /** Source code repository */
  repository?: PackageRepository;

  /** Package homepage URL */
  homepage?: string;

  /** Documentation URL */
  documentation?: string;

  /** Changelog URL */
  changelog?: string;

  /** SPDX license identifier */
  license: string;

  /** License URL */
  licenseUrl?: string;

  /** MCP protocol version */
  mcpVersion: string;

  /** Declared MCP capabilities */
  capabilities: MCPCapability[];

  /** Required permissions */
  requiredPermissions: string[];

  /** Package status */
  status: PackageStatus;

  /** Verification status */
  verificationStatus: VerificationStatus;

  /** Security scan status */
  securityScanStatus: SecurityScanStatus;

  /** Last security scan timestamp */
  lastSecurityScan?: string;

  /** Additional search keywords */
  searchKeywords: string[];

  /** README content (markdown) */
  readme?: string;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  /** Publication timestamp (ISO 8601) */
  publishedAt?: string;

  /** Deprecation timestamp (ISO 8601) */
  deprecatedAt?: string;

  /** Deprecation message */
  deprecationMessage?: string;
}

/**
 * Package version metadata
 */
export interface PackageVersion {
  /** Package ID */
  packageId: string;

  /** Semver version string */
  version: string;

  /** Major version number */
  semverMajor: number;

  /** Minor version number */
  semverMinor: number;

  /** Patch version number */
  semverPatch: number;

  /** Prerelease identifier (e.g., "beta.1") */
  prerelease?: string;

  /** Distribution information */
  distribution: {
    /** S3 URL to tarball */
    tarball: string;
    /** SHA256 hash */
    shasum: string;
    /** Subresource Integrity hash */
    integrity: string;
    /** Compressed size in bytes */
    size: number;
    /** Uncompressed size in bytes */
    unpackedSize: number;
  };

  /** Package dependencies */
  dependencies: Record<string, string>;

  /** Peer dependencies */
  peerDependencies?: Record<string, string>;

  /** Optional dependencies */
  optionalDependencies?: Record<string, string>;

  /** Runtime requirements */
  runtime: PackageRuntime;

  /** MCP manifest from package */
  mcpManifest: MCPManifest;

  /** Changelog for this version */
  changelog?: string;

  /** Has breaking changes */
  breaking?: boolean;

  /** Publisher user ID */
  publishedBy: string;

  /** Publication timestamp */
  publishedAt: string;

  /** Whether this version is deprecated */
  deprecated: boolean;

  /** Deprecation message */
  deprecationMessage?: string;

  /** Whether this version is yanked */
  yanked: boolean;

  /** Reason for yanking */
  yankedReason?: string;

  /** Security vulnerabilities */
  vulnerabilities: {
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
    count: number;
    advisoryIds?: string[];
  };

  /** Download count for this version */
  downloads: number;
}

/**
 * MCP manifest structure (from package.json or mcp.json)
 */
export interface MCPManifest {
  /** MCP protocol version */
  version: string;

  /** Server name */
  name: string;

  /** Server description */
  description: string;

  /** Declared tools */
  tools?: MCPTool[];

  /** Declared resources */
  resources?: MCPResource[];

  /** Declared prompts */
  prompts?: MCPPrompt[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Lightweight package for list views
 */
export interface PackageListItem {
  packageId: string;
  name: string;
  shortDescription: string;
  latestVersion: string;
  publisherName: string;
  publisherVerified: boolean;
  category: string;
  tags: string[];
  stats: Pick<PackageStats, 'totalDownloads' | 'averageRating' | 'reviewCount'>;
  verificationStatus: VerificationStatus;
  updatedAt: string;
}

/**
 * Package search result with highlights
 */
export interface PackageSearchResult extends PackageListItem {
  highlights?: {
    name?: string[];
    description?: string[];
    tags?: string[];
  };
  score?: number;
}
