/**
 * Shared Constants
 *
 * Constants used across all MCPSearch packages.
 */

// ============================================
// API Configuration
// ============================================

export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}`;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ============================================
// Package Categories
// ============================================

export const CATEGORIES = {
  utilities: {
    id: 'utilities',
    name: 'Utilities',
    description: 'File system, shell, and general-purpose utilities',
    icon: 'wrench',
  },
  database: {
    id: 'database',
    name: 'Database',
    description: 'Database connectors and query tools',
    icon: 'database',
  },
  api: {
    id: 'api',
    name: 'APIs & Integrations',
    description: 'Third-party API integrations and connectors',
    icon: 'cloud',
  },
  development: {
    id: 'development',
    name: 'Development',
    description: 'Development tools, debugging, and testing',
    icon: 'code',
  },
  productivity: {
    id: 'productivity',
    name: 'Productivity',
    description: 'Calendar, email, notes, and task management',
    icon: 'calendar',
  },
  data: {
    id: 'data',
    name: 'Data & Analytics',
    description: 'Data processing, analysis, and visualization',
    icon: 'chart',
  },
  communication: {
    id: 'communication',
    name: 'Communication',
    description: 'Slack, Discord, Teams, and messaging integrations',
    icon: 'message',
  },
  security: {
    id: 'security',
    name: 'Security',
    description: 'Security tools, authentication, and encryption',
    icon: 'shield',
  },
  ai: {
    id: 'ai',
    name: 'AI & ML',
    description: 'AI model integrations and machine learning tools',
    icon: 'brain',
  },
  other: {
    id: 'other',
    name: 'Other',
    description: 'Miscellaneous tools and integrations',
    icon: 'box',
  },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

// ============================================
// Tool Configuration
// ============================================

export const SUPPORTED_TOOLS = {
  claudeCode: {
    id: 'claudeCode',
    name: 'Claude Code',
    configFile: '.claude/settings.json',
    configPath: ['mcpServers'],
    docsUrl: 'https://docs.anthropic.com/claude-code',
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    configFile: '.cursor/mcp.json',
    configPath: ['servers'],
    docsUrl: 'https://docs.cursor.com',
  },
  windsurf: {
    id: 'windsurf',
    name: 'Windsurf',
    configFile: '.windsurf/mcp.json',
    configPath: ['servers'],
    docsUrl: 'https://docs.codeium.com/windsurf',
  },
  continueDev: {
    id: 'continueDev',
    name: 'Continue.dev',
    configFile: '.continue/config.json',
    configPath: ['mcpServers'],
    docsUrl: 'https://docs.continue.dev',
  },
} as const;

export type ToolId = keyof typeof SUPPORTED_TOOLS;

// ============================================
// MCP Protocol
// ============================================

export const MCP_PROTOCOL_VERSION = '1.0.0';

export const MCP_CAPABILITIES = ['tools', 'resources', 'prompts', 'sampling'] as const;

// ============================================
// Limits & Constraints
// ============================================

export const LIMITS = {
  // Package
  packageNameMaxLength: 100,
  packageDescriptionMaxLength: 5000,
  packageShortDescriptionMaxLength: 150,
  packageTagsMax: 10,
  packageTagMaxLength: 30,
  packageReadmeMaxLength: 100000,

  // User
  usernameMinLength: 3,
  usernameMaxLength: 39,
  displayNameMaxLength: 100,
  bioMaxLength: 500,

  // Review
  reviewTitleMaxLength: 100,
  reviewBodyMaxLength: 5000,

  // API
  searchQueryMaxLength: 200,
  apiKeyNameMaxLength: 50,
  apiKeysMax: 10,

  // Upload
  packageMaxSizeBytes: 50 * 1024 * 1024, // 50MB
} as const;

// ============================================
// HTTP Status Codes
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',

  // Auth
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_EXPIRED: 'API_KEY_EXPIRED',
  INSUFFICIENT_SCOPES: 'INSUFFICIENT_SCOPES',

  // Package
  PACKAGE_NOT_FOUND: 'PACKAGE_NOT_FOUND',
  PACKAGE_ALREADY_EXISTS: 'PACKAGE_ALREADY_EXISTS',
  VERSION_ALREADY_EXISTS: 'VERSION_ALREADY_EXISTS',
  INVALID_VERSION: 'INVALID_VERSION',
  PACKAGE_DEPRECATED: 'PACKAGE_DEPRECATED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',

  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  NOT_PUBLISHER: 'NOT_PUBLISHER',

  // Review
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',
  ALREADY_REVIEWED: 'ALREADY_REVIEWED',
  CANNOT_REVIEW_OWN_PACKAGE: 'CANNOT_REVIEW_OWN_PACKAGE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ============================================
// Cache TTLs (seconds)
// ============================================

export const CACHE_TTL = {
  packageList: 60, // 1 minute
  packageDetail: 300, // 5 minutes
  searchResults: 60, // 1 minute
  userProfile: 300, // 5 minutes
  categories: 3600, // 1 hour
  trending: 300, // 5 minutes
  dashboardStats: 60, // 1 minute
} as const;

// ============================================
// Rate Limits
// ============================================

export const RATE_LIMITS = {
  anonymous: {
    search: { requests: 30, windowSeconds: 60 },
    download: { requests: 100, windowSeconds: 3600 },
    general: { requests: 60, windowSeconds: 60 },
  },
  authenticated: {
    search: { requests: 100, windowSeconds: 60 },
    download: { requests: 1000, windowSeconds: 3600 },
    publish: { requests: 10, windowSeconds: 3600 },
    general: { requests: 300, windowSeconds: 60 },
  },
  apiKey: {
    multiplier: 5,
  },
} as const;
