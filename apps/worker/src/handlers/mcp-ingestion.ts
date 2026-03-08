/**
 * MCP Ingestion Handler
 *
 * Fetches and ingests MCP servers from various public sources:
 * - npm registry (most reliable, structured JSON)
 * - GitHub repositories (official servers)
 * - awesome-mcp-servers lists
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Logger } from 'pino';
import type { Package, PackageCompatibility, PackageStats } from '@mcpsearch/shared';

const dynamoClient = new DynamoDBClient({
  ...(process.env['DYNAMODB_ENDPOINT'] && { endpoint: process.env['DYNAMODB_ENDPOINT'] }),
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env['DYNAMODB_TABLE'] || 'mcp-search-dev';

// npm search API
const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search';
// npm package details
const NPM_REGISTRY_URL = 'https://registry.npmjs.org';

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
      keywords?: string[];
      author?: { name: string; email?: string };
      publisher?: { username: string; email?: string };
      links?: {
        npm?: string;
        homepage?: string;
        repository?: string;
        bugs?: string;
      };
      date?: string;
    };
    score: {
      final: number;
      detail: {
        quality: number;
        popularity: number;
        maintenance: number;
      };
    };
  }>;
  total: number;
}

interface NpmPackageDetails {
  name: string;
  description?: string;
  'dist-tags'?: { latest?: string };
  versions?: Record<string, {
    version: string;
    description?: string;
    keywords?: string[];
    license?: string;
    repository?: { type?: string; url?: string };
    homepage?: string;
    author?: string | { name: string; email?: string };
    mcp?: {
      capabilities?: string[];
      tools?: unknown[];
      resources?: unknown[];
      prompts?: unknown[];
    };
  }>;
  time?: Record<string, string>;
  readme?: string;
  license?: string;
  repository?: { type?: string; url?: string };
  homepage?: string;
}

interface IngestionResult {
  source: string;
  total: number;
  ingested: number;
  skipped: number;
  errors: number;
  packages: string[];
}

export interface IngestionPayload {
  sources?: ('npm' | 'github' | 'awesome')[];
  limit?: number;
  offset?: number;
  forceUpdate?: boolean;
  outputMode?: 'dynamodb' | 'json';
  outputPath?: string;
}

// In-memory storage for JSON output mode
let jsonOutputPackages: Package[] = [];

/**
 * Main ingestion handler
 */
export async function handleMcpIngestion(
  payload: IngestionPayload,
  logger: Logger
): Promise<IngestionResult[]> {
  const sources = payload.sources || ['npm'];
  const results: IngestionResult[] = [];

  // Reset JSON output buffer and set output mode
  jsonOutputPackages = [];
  currentOutputMode = payload.outputMode || 'dynamodb';

  for (const source of sources) {
    logger.info({ source }, 'Starting ingestion from source');

    try {
      let result: IngestionResult;

      switch (source) {
        case 'npm':
          result = await ingestFromNpm(payload, logger);
          break;
        case 'github':
          result = await ingestFromGitHub(payload, logger);
          break;
        case 'awesome':
          result = await ingestFromAwesome(payload, logger);
          break;
        default:
          logger.warn({ source }, 'Unknown source, skipping');
          continue;
      }

      results.push(result);
      logger.info({ source, result }, 'Completed ingestion from source');
    } catch (error) {
      logger.error({ error, source }, 'Failed to ingest from source');
      results.push({
        source,
        total: 0,
        ingested: 0,
        skipped: 0,
        errors: 1,
        packages: [],
      });
    }
  }

  // If JSON output mode, write to file
  if (payload.outputMode === 'json' && jsonOutputPackages.length > 0) {
    const fs = await import('fs/promises');
    const outputPath = payload.outputPath || './mcp-packages.json';
    await fs.writeFile(outputPath, JSON.stringify(jsonOutputPackages, null, 2));
    logger.info({ outputPath, count: jsonOutputPackages.length }, 'Wrote packages to JSON file');
  }

  return results;
}

/**
 * Get all ingested packages (for JSON mode)
 */
export function getIngestedPackages(): Package[] {
  return jsonOutputPackages;
}

/**
 * Ingest MCP servers from npm registry
 */
async function ingestFromNpm(
  payload: IngestionPayload,
  logger: Logger
): Promise<IngestionResult> {
  const limit = payload.limit || 250;
  const result: IngestionResult = {
    source: 'npm',
    total: 0,
    ingested: 0,
    skipped: 0,
    errors: 0,
    packages: [],
  };

  // Search queries to find MCP servers
  const searchQueries = [
    'mcp-server',
    '@modelcontextprotocol',
    'model-context-protocol',
    'mcp server',
  ];

  const seenPackages = new Set<string>();

  for (const query of searchQueries) {
    try {
      logger.debug({ query }, 'Searching npm');

      const searchUrl = `${NPM_SEARCH_URL}?text=${encodeURIComponent(query)}&size=${limit}`;
      const response = await fetch(searchUrl);

      if (!response.ok) {
        logger.warn({ query, status: response.status }, 'npm search failed');
        continue;
      }

      const data = (await response.json()) as NpmSearchResult;
      result.total += data.objects.length;

      for (const obj of data.objects) {
        const pkgName = obj.package.name;

        // Skip if already processed
        if (seenPackages.has(pkgName)) {
          continue;
        }
        seenPackages.add(pkgName);

        // Filter: must be MCP related
        const isMcpPackage = isMcpRelated(pkgName, obj.package.description, obj.package.keywords);
        if (!isMcpPackage) {
          result.skipped++;
          continue;
        }

        try {
          // Check if package already exists and skip if not forcing update
          if (!payload.forceUpdate) {
            const existing = await getExistingPackage(pkgName);
            if (existing) {
              logger.debug({ packageId: pkgName }, 'Package already exists, skipping');
              result.skipped++;
              continue;
            }
          }

          // Fetch full package details
          const details = await fetchNpmPackageDetails(pkgName);
          if (!details) {
            result.errors++;
            continue;
          }

          // Transform to our Package type
          const pkg = transformNpmToPackage(obj, details);

          // Save to DynamoDB
          await savePackage(pkg, logger);

          result.ingested++;
          result.packages.push(pkgName);

          logger.info({ packageId: pkgName }, 'Ingested package from npm');

          // Rate limiting
          await sleep(100);
        } catch (error) {
          logger.error({ error, packageId: pkgName }, 'Failed to ingest package');
          result.errors++;
        }
      }
    } catch (error) {
      logger.error({ error, query }, 'Failed to search npm');
    }
  }

  return result;
}

/**
 * Ingest from official GitHub modelcontextprotocol/servers
 */
async function ingestFromGitHub(
  payload: IngestionPayload,
  logger: Logger
): Promise<IngestionResult> {
  const result: IngestionResult = {
    source: 'github',
    total: 0,
    ingested: 0,
    skipped: 0,
    errors: 0,
    packages: [],
  };

  try {
    // Fetch the official servers list
    const response = await fetch(
      'https://api.github.com/repos/modelcontextprotocol/servers/contents/src',
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'MCPSearch-Ingestion/1.0',
        },
      }
    );

    if (!response.ok) {
      logger.error({ status: response.status }, 'Failed to fetch GitHub servers list');
      return result;
    }

    const contents = (await response.json()) as Array<{
      name: string;
      type: string;
      path: string;
    }>;

    const serverDirs = contents.filter((c) => c.type === 'dir');
    result.total = serverDirs.length;

    for (const dir of serverDirs) {
      try {
        const pkgName = `@modelcontextprotocol/server-${dir.name}`;

        // Check if exists
        if (!payload.forceUpdate) {
          const existing = await getExistingPackage(pkgName);
          if (existing) {
            result.skipped++;
            continue;
          }
        }

        // Fetch package.json from GitHub
        const pkgJsonResponse = await fetch(
          `https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src/${dir.name}/package.json`
        );

        if (!pkgJsonResponse.ok) {
          logger.warn({ server: dir.name }, 'No package.json found');
          result.skipped++;
          continue;
        }

        const pkgJson = (await pkgJsonResponse.json()) as {
          name: string;
          version: string;
          description?: string;
          keywords?: string[];
          license?: string;
        };

        // Also try to get npm details if published
        let npmDetails: NpmPackageDetails | null = null;
        try {
          npmDetails = await fetchNpmPackageDetails(pkgJson.name);
        } catch {
          // Package might not be on npm yet
        }

        const pkg = createOfficialPackage(dir.name, pkgJson, npmDetails);
        await savePackage(pkg, logger);

        result.ingested++;
        result.packages.push(pkgName);

        logger.info({ packageId: pkgName }, 'Ingested official server');

        await sleep(200);
      } catch (error) {
        logger.error({ error, server: dir.name }, 'Failed to ingest official server');
        result.errors++;
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to fetch from GitHub');
    result.errors++;
  }

  return result;
}

/**
 * Ingest from awesome-mcp-servers list (parses README)
 */
async function ingestFromAwesome(
  payload: IngestionPayload,
  logger: Logger
): Promise<IngestionResult> {
  const result: IngestionResult = {
    source: 'awesome',
    total: 0,
    ingested: 0,
    skipped: 0,
    errors: 0,
    packages: [],
  };

  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md'
    );

    if (!response.ok) {
      logger.error({ status: response.status }, 'Failed to fetch awesome-mcp-servers');
      return result;
    }

    const readme = await response.text();
    const servers = parseAwesomeReadme(readme);
    result.total = servers.length;

    logger.info({ count: servers.length }, 'Parsed servers from awesome-mcp-servers');

    for (const server of servers) {
      if (payload.limit && result.ingested >= payload.limit) {
        break;
      }

      try {
        // Skip if exists
        if (!payload.forceUpdate) {
          const existing = await getExistingPackage(server.id);
          if (existing) {
            result.skipped++;
            continue;
          }
        }

        // Try to get npm details if it's an npm package
        let npmDetails: NpmPackageDetails | null = null;
        if (server.npmPackage) {
          try {
            npmDetails = await fetchNpmPackageDetails(server.npmPackage);
          } catch {
            // Not on npm
          }
        }

        const pkg = createAwesomePackage(server, npmDetails);
        await savePackage(pkg, logger);

        result.ingested++;
        result.packages.push(server.id);

        await sleep(50);
      } catch (error) {
        logger.error({ error, server: server.id }, 'Failed to ingest awesome server');
        result.errors++;
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to parse awesome-mcp-servers');
    result.errors++;
  }

  return result;
}

interface ParsedAwesomeServer {
  id: string;
  name: string;
  description: string;
  repoUrl?: string;
  npmPackage?: string;
  language: string;
  category: string;
  serviceType: string;
}

/**
 * Parse the awesome-mcp-servers README
 */
function parseAwesomeReadme(readme: string): ParsedAwesomeServer[] {
  const servers: ParsedAwesomeServer[] = [];
  const lines = readme.split('\n');

  let currentCategory = 'uncategorized';

  // Emoji to language mapping
  const languageEmojis: Record<string, string> = {
    '🐍': 'python',
    '📇': 'typescript',
    '🏎️': 'go',
    '🦀': 'rust',
    '☕': 'java',
    '#️⃣': 'csharp',
    '💎': 'ruby',
  };

  // Service type emojis
  const serviceEmojis: Record<string, string> = {
    '☁️': 'cloud',
    '🏠': 'local',
    '📟': 'embedded',
  };

  for (const line of lines) {
    // Detect category headers (## Category or ### Category)
    const categoryMatch = line.match(/^#{2,3}\s+(.+)/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
      continue;
    }

    // Parse server entries: - [name](url) emoji emoji - description
    const serverMatch = line.match(
      /^-\s*\[([^\]]+)\]\(([^)]+)\)\s*(.+)?$/
    );

    if (serverMatch) {
      const name = serverMatch[1];
      const url = serverMatch[2];
      const rest = serverMatch[3] || '';

      // Extract language
      let language = 'unknown';
      for (const [emoji, lang] of Object.entries(languageEmojis)) {
        if (rest.includes(emoji)) {
          language = lang;
          break;
        }
      }

      // Extract service type
      let serviceType = 'unknown';
      for (const [emoji, svc] of Object.entries(serviceEmojis)) {
        if (rest.includes(emoji)) {
          serviceType = svc;
          break;
        }
      }

      // Extract description (after the dash)
      const descMatch = rest.match(/-\s*(.+)$/);
      const description = descMatch ? descMatch[1].trim() : name;

      // Generate ID from URL
      let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let npmPackage: string | undefined;

      // Check if it's a GitHub URL
      if (url.includes('github.com')) {
        const ghMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (ghMatch) {
          id = `github-${ghMatch[1]}-${ghMatch[2]}`.toLowerCase();
        }
      }

      // Check if it might be an npm package
      if (url.includes('npmjs.com') || url.includes('npm/')) {
        const npmMatch = url.match(/(?:npmjs\.com\/package\/|npm\/)([^/\s]+)/);
        if (npmMatch) {
          npmPackage = npmMatch[1];
          id = npmPackage;
        }
      }

      servers.push({
        id,
        name,
        description,
        repoUrl: url.includes('github.com') ? url : undefined,
        npmPackage,
        language,
        category: currentCategory,
        serviceType,
      });
    }
  }

  return servers;
}

/**
 * Check if a package is MCP related
 */
function isMcpRelated(name: string, description?: string, keywords?: string[]): boolean {
  const nameCheck = name.toLowerCase();
  const descCheck = (description || '').toLowerCase();
  const keywordCheck = (keywords || []).map((k) => k.toLowerCase());

  const mcpTerms = [
    'mcp-server',
    'mcp server',
    'modelcontextprotocol',
    'model-context-protocol',
    'model context protocol',
  ];

  // Must have MCP in name or description
  for (const term of mcpTerms) {
    if (nameCheck.includes(term) || descCheck.includes(term)) {
      return true;
    }
  }

  // Check keywords
  const mcpKeywords = ['mcp', 'modelcontextprotocol', 'mcp-server'];
  for (const kw of keywordCheck) {
    if (mcpKeywords.includes(kw)) {
      return true;
    }
  }

  return false;
}

/**
 * Fetch package details from npm
 */
async function fetchNpmPackageDetails(packageName: string): Promise<NpmPackageDetails | null> {
  try {
    const response = await fetch(`${NPM_REGISTRY_URL}/${encodeURIComponent(packageName)}`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as NpmPackageDetails;
  } catch {
    return null;
  }
}

/**
 * Check if package exists
 */
async function getExistingPackage(packageId: string): Promise<boolean> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `PKG#${packageId}`,
          SK: 'META',
        },
        ProjectionExpression: 'packageId',
      })
    );
    return !!result.Item;
  } catch {
    return false;
  }
}

/**
 * Transform npm search result to Package
 */
function transformNpmToPackage(
  searchResult: NpmSearchResult['objects'][0],
  details: NpmPackageDetails
): Package {
  const now = new Date().toISOString();
  const pkg = searchResult.package;
  const latestVersion = details['dist-tags']?.latest || pkg.version;
  const versionData = details.versions?.[latestVersion];

  // Determine category from keywords/description
  const category = determineCategory(pkg.keywords, pkg.description);

  // Extract capabilities from mcp manifest if available
  const capabilities = extractCapabilities(versionData?.mcp);

  // Get repository URL
  let repoUrl = pkg.links?.repository || details.repository?.url;
  if (repoUrl?.startsWith('git+')) {
    repoUrl = repoUrl.slice(4);
  }
  if (repoUrl?.endsWith('.git')) {
    repoUrl = repoUrl.slice(0, -4);
  }

  const defaultCompatibility: PackageCompatibility = {
    claudeCode: { supported: true },
    cursor: { supported: true },
    windsurf: { supported: true },
    continueDev: { supported: true },
  };

  const defaultStats: PackageStats = {
    totalDownloads: 0,
    weeklyDownloads: 0,
    monthlyDownloads: 0,
    stars: 0,
    reviewCount: 0,
    averageRating: 0,
  };

  return {
    packageId: pkg.name,
    name: formatPackageName(pkg.name),
    description: details.readme || pkg.description || '',
    shortDescription: truncate(pkg.description || '', 150),
    latestVersion,
    latestStableVersion: latestVersion,
    versionCount: Object.keys(details.versions || {}).length,
    publisherId: 'npm-import',
    publisherName: pkg.publisher?.username || pkg.author?.name || 'Unknown',
    publisherVerified: pkg.name.startsWith('@modelcontextprotocol/'),
    category,
    tags: pkg.keywords || [],
    compatibility: defaultCompatibility,
    stats: defaultStats,
    repository: repoUrl
      ? {
          type: repoUrl.includes('github.com') ? 'github' : 'other',
          url: repoUrl,
        }
      : undefined,
    homepage: pkg.links?.homepage || details.homepage,
    license: versionData?.license || details.license || 'Unknown',
    mcpVersion: '1.0',
    capabilities,
    requiredPermissions: [],
    status: 'published',
    verificationStatus: pkg.name.startsWith('@modelcontextprotocol/') ? 'official' : 'unverified',
    securityScanStatus: 'pending',
    searchKeywords: [...(pkg.keywords || []), ...pkg.name.split(/[-/@]/g).filter(Boolean)],
    readme: details.readme,
    createdAt: details.time?.created || now,
    updatedAt: details.time?.modified || now,
    publishedAt: pkg.date || now,
  };
}

/**
 * Create package from official GitHub server
 */
function createOfficialPackage(
  serverName: string,
  pkgJson: { name: string; version: string; description?: string; keywords?: string[]; license?: string },
  npmDetails: NpmPackageDetails | null
): Package {
  const now = new Date().toISOString();

  const defaultCompatibility: PackageCompatibility = {
    claudeCode: { supported: true },
    cursor: { supported: true },
    windsurf: { supported: true },
    continueDev: { supported: true },
  };

  const defaultStats: PackageStats = {
    totalDownloads: 0,
    weeklyDownloads: 0,
    monthlyDownloads: 0,
    stars: 0,
    reviewCount: 0,
    averageRating: 0,
  };

  return {
    packageId: pkgJson.name,
    name: formatPackageName(pkgJson.name),
    description: npmDetails?.readme || pkgJson.description || '',
    shortDescription: truncate(pkgJson.description || '', 150),
    latestVersion: npmDetails?.['dist-tags']?.latest || pkgJson.version,
    latestStableVersion: npmDetails?.['dist-tags']?.latest || pkgJson.version,
    versionCount: npmDetails ? Object.keys(npmDetails.versions || {}).length : 1,
    publisherId: 'anthropic',
    publisherName: 'Anthropic',
    publisherVerified: true,
    category: determineCategory(pkgJson.keywords, pkgJson.description),
    tags: pkgJson.keywords || ['mcp', 'official'],
    compatibility: defaultCompatibility,
    stats: defaultStats,
    repository: {
      type: 'github',
      url: `https://github.com/modelcontextprotocol/servers/tree/main/src/${serverName}`,
    },
    homepage: 'https://modelcontextprotocol.io',
    license: pkgJson.license || 'MIT',
    mcpVersion: '1.0',
    capabilities: ['tools'],
    requiredPermissions: [],
    status: 'published',
    verificationStatus: 'official',
    securityScanStatus: 'passed',
    searchKeywords: ['official', 'anthropic', serverName, ...(pkgJson.keywords || [])],
    readme: npmDetails?.readme,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };
}

/**
 * Create package from awesome-mcp-servers entry
 */
function createAwesomePackage(
  server: ParsedAwesomeServer,
  npmDetails: NpmPackageDetails | null
): Package {
  const now = new Date().toISOString();

  const defaultCompatibility: PackageCompatibility = {
    claudeCode: { supported: true },
    cursor: { supported: true },
    windsurf: { supported: true },
    continueDev: { supported: true },
  };

  const defaultStats: PackageStats = {
    totalDownloads: 0,
    weeklyDownloads: 0,
    monthlyDownloads: 0,
    stars: 0,
    reviewCount: 0,
    averageRating: 0,
  };

  return {
    packageId: server.id,
    name: server.name,
    description: npmDetails?.readme || server.description,
    shortDescription: truncate(server.description, 150),
    latestVersion: npmDetails?.['dist-tags']?.latest || '0.0.0',
    latestStableVersion: npmDetails?.['dist-tags']?.latest || '0.0.0',
    versionCount: npmDetails ? Object.keys(npmDetails.versions || {}).length : 0,
    publisherId: 'awesome-import',
    publisherName: 'Community',
    publisherVerified: false,
    category: server.category,
    tags: [server.language, server.serviceType, server.category].filter(
      (t) => t && t !== 'unknown'
    ),
    compatibility: defaultCompatibility,
    stats: defaultStats,
    repository: server.repoUrl
      ? {
          type: 'github',
          url: server.repoUrl,
        }
      : undefined,
    license: npmDetails?.license || 'Unknown',
    mcpVersion: '1.0',
    capabilities: ['tools'],
    requiredPermissions: [],
    status: 'published',
    verificationStatus: 'unverified',
    securityScanStatus: 'pending',
    searchKeywords: [server.language, server.category, ...server.name.split(/[\s-]+/)],
    readme: npmDetails?.readme,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };
}

// Current output mode (set during ingestion)
let currentOutputMode: 'dynamodb' | 'json' = 'dynamodb';

/**
 * Set the output mode for the current ingestion
 */
export function setOutputMode(mode: 'dynamodb' | 'json'): void {
  currentOutputMode = mode;
}

/**
 * Save package to DynamoDB or JSON buffer
 */
async function savePackage(pkg: Package, logger: Logger): Promise<void> {
  if (currentOutputMode === 'json') {
    jsonOutputPackages.push(pkg);
    return;
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `PKG#${pkg.packageId}`,
          SK: 'META',
          GSI1PK: `CAT#${pkg.category}`,
          GSI1SK: `PKG#${pkg.packageId}`,
          GSI2PK: `PUB#${pkg.publisherId}`,
          GSI2SK: `PKG#${pkg.packageId}`,
          ...pkg,
        },
      })
    );
  } catch (error) {
    // If DynamoDB fails, fall back to JSON mode
    logger.warn({ error }, 'DynamoDB save failed, collecting to JSON buffer');
    jsonOutputPackages.push(pkg);
  }
}

function determineCategory(keywords?: string[], description?: string): string {
  const text = [...(keywords || []), description || ''].join(' ').toLowerCase();

  const categoryMap: Record<string, string[]> = {
    'file-system': ['filesystem', 'file', 'directory', 'folder'],
    database: ['database', 'sql', 'postgres', 'mysql', 'mongodb', 'redis', 'dynamodb'],
    'version-control': ['git', 'github', 'gitlab', 'version control'],
    search: ['search', 'elasticsearch', 'opensearch', 'algolia'],
    ai: ['ai', 'llm', 'openai', 'anthropic', 'claude', 'gpt'],
    communication: ['slack', 'discord', 'email', 'notification', 'chat'],
    cloud: ['aws', 'azure', 'gcp', 'cloud', 's3', 'lambda'],
    browser: ['browser', 'puppeteer', 'playwright', 'selenium', 'web'],
    api: ['api', 'rest', 'graphql', 'http'],
    memory: ['memory', 'knowledge', 'context', 'rag'],
    developer: ['dev', 'developer', 'tool', 'utility'],
  };

  for (const [category, terms] of Object.entries(categoryMap)) {
    if (terms.some((term) => text.includes(term))) {
      return category;
    }
  }

  return 'other';
}

function extractCapabilities(mcp?: { capabilities?: string[]; tools?: unknown[]; resources?: unknown[]; prompts?: unknown[] }): Array<'tools' | 'resources' | 'prompts' | 'sampling'> {
  if (!mcp) return ['tools'];

  const caps: Array<'tools' | 'resources' | 'prompts' | 'sampling'> = [];

  if (mcp.capabilities) {
    return mcp.capabilities.filter(
      (c): c is 'tools' | 'resources' | 'prompts' | 'sampling' =>
        ['tools', 'resources', 'prompts', 'sampling'].includes(c)
    );
  }

  if (mcp.tools && Array.isArray(mcp.tools) && mcp.tools.length > 0) caps.push('tools');
  if (mcp.resources && Array.isArray(mcp.resources) && mcp.resources.length > 0) caps.push('resources');
  if (mcp.prompts && Array.isArray(mcp.prompts) && mcp.prompts.length > 0) caps.push('prompts');

  return caps.length > 0 ? caps : ['tools'];
}

function formatPackageName(packageId: string): string {
  // @modelcontextprotocol/server-filesystem -> Filesystem
  // mcp-server-github -> GitHub
  return packageId
    .replace(/^@[^/]+\//, '')
    .replace(/^(mcp-server-|server-)/, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
