/**
 * Analytics Types
 *
 * Type definitions for download analytics and telemetry.
 */

export type Platform = 'darwin' | 'linux' | 'win32';
export type ToolType = 'claudeCode' | 'cursor' | 'windsurf' | 'continueDev' | 'cli' | 'other';

/**
 * Daily download aggregation
 */
export interface DailyDownload {
  /** Package ID */
  packageId: string;

  /** Date (YYYY-MM-DD) */
  date: string;

  /** Download breakdown */
  downloads: {
    /** Total downloads */
    total: number;

    /** Downloads by version */
    byVersion: Record<string, number>;

    /** Downloads by tool */
    byTool: Record<ToolType, number>;

    /** Downloads by region (country code) */
    byRegion: Record<string, number>;

    /** Downloads by platform */
    byPlatform: Record<Platform, number>;
  };

  /** Unique user count (approximate) */
  uniqueUsers: number;

  /** Unique IP count (approximate) */
  uniqueIps: number;
}

/**
 * Hourly download (for real-time dashboard)
 */
export interface HourlyDownload {
  /** Package ID */
  packageId: string;

  /** Hour (YYYY-MM-DDTHH) */
  hour: string;

  /** Download count */
  downloads: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

/**
 * Package analytics summary
 */
export interface PackageAnalytics {
  /** Package ID */
  packageId: string;

  /** Time range */
  timeRange: {
    start: string;
    end: string;
  };

  /** Summary statistics */
  summary: {
    totalDownloads: number;
    uniqueUsers: number;
    averageDailyDownloads: number;
    peakDownloads: number;
    peakDate: string;
  };

  /** Download time series */
  downloadSeries: TimeSeriesPoint[];

  /** Downloads by version */
  versionBreakdown: Array<{
    version: string;
    downloads: number;
    percentage: number;
  }>;

  /** Downloads by tool */
  toolBreakdown: Array<{
    tool: ToolType;
    downloads: number;
    percentage: number;
  }>;

  /** Downloads by region (top 10) */
  regionBreakdown: Array<{
    region: string;
    regionName: string;
    downloads: number;
    percentage: number;
  }>;

  /** Downloads by platform */
  platformBreakdown: Array<{
    platform: Platform;
    downloads: number;
    percentage: number;
  }>;
}

/**
 * CLI telemetry event
 */
export interface TelemetryEvent {
  /** Event type */
  event: 'install' | 'update' | 'remove' | 'search' | 'info' | 'error';

  /** Timestamp */
  timestamp: string;

  /** CLI version */
  cliVersion: string;

  /** Platform */
  platform: Platform;

  /** Architecture */
  arch: 'x64' | 'arm64';

  /** Tool being configured */
  tool?: ToolType;

  /** Package ID (for package events) */
  packageId?: string;

  /** Package version */
  packageVersion?: string;

  /** Search query (for search events) */
  searchQuery?: string;

  /** Error code (for error events) */
  errorCode?: string;

  /** Duration in ms */
  duration?: number;

  /** Whether operation succeeded */
  success: boolean;

  /** Anonymous session ID */
  sessionId: string;
}

/**
 * Trending package calculation
 */
export interface TrendingPackage {
  packageId: string;
  name: string;
  shortDescription: string;
  currentDownloads: number;
  previousDownloads: number;
  growthRate: number;
  trendScore: number;
  rank: number;
}

/**
 * Dashboard overview stats
 */
export interface DashboardStats {
  /** Total packages in registry */
  totalPackages: number;

  /** Total registered users */
  totalUsers: number;

  /** Total downloads (all time) */
  totalDownloads: number;

  /** Downloads in last 24 hours */
  downloadsToday: number;

  /** Downloads in last 7 days */
  downloadsThisWeek: number;

  /** New packages in last 7 days */
  newPackagesThisWeek: number;

  /** Active publishers (published in last 30 days) */
  activePublishers: number;
}
