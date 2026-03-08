/**
 * CLI Routes
 *
 * Endpoints specifically for CLI tool usage.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { logger } from '../lib/logger.js';
import { packageService } from '../services/package-service.js';
import * as semver from 'semver';

const router = Router();

interface PackageSpec {
  name: string;
  version?: string;
}

interface ResolvedPackage {
  packageId: string;
  name: string;
  version: string;
  downloadUrl: string;
  integrity?: string;
  capabilities: string[];
  configSnippet?: Record<string, unknown>;
}

/**
 * POST /cli/resolve
 * Resolve packages for installation
 */
const resolvePackages: RequestHandler = async (req, res, next) => {
  try {
    const { packages, tool } = req.body as { packages: PackageSpec[]; tool?: string };

    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'packages array is required' },
      });
      return;
    }

    logger.debug({ packages, tool }, 'Resolving packages');

    const resolved: ResolvedPackage[] = [];
    const errors: Array<{ packageId: string; error: string }> = [];

    for (const spec of packages) {
      try {
        // Get package details
        const pkg = await packageService.getById(spec.name);

        if (!pkg) {
          errors.push({ packageId: spec.name, error: 'Package not found' });
          continue;
        }

        // Resolve version
        let targetVersion = pkg.latestVersion;

        if (spec.version) {
          // Get all versions and find matching one
          const versions = await packageService.getVersions(spec.name);
          const versionNumbers = versions.map(v => v.version);

          // Use semver to find the best match
          const matched = semver.maxSatisfying(versionNumbers, spec.version);
          if (matched) {
            targetVersion = matched;
          } else {
            errors.push({
              packageId: spec.name,
              error: `No version matching "${spec.version}" found`
            });
            continue;
          }
        }

        // Get download URL
        const downloadUrl = await packageService.getDownloadUrl(spec.name, targetVersion);

        // Build config snippet based on tool
        const configSnippet = buildConfigSnippet(pkg.packageId, pkg.name, tool);

        resolved.push({
          packageId: pkg.packageId,
          name: pkg.name,
          version: targetVersion,
          downloadUrl,
          capabilities: pkg.capabilities || [],
          configSnippet,
        });
      } catch (error) {
        logger.error({ error, packageId: spec.name }, 'Failed to resolve package');
        errors.push({ packageId: spec.name, error: 'Resolution failed' });
      }
    }

    res.json({
      success: true,
      data: {
        resolved,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

function buildConfigSnippet(
  packageId: string,
  name: string,
  tool?: string
): Record<string, unknown> {
  // Generate tool-specific config snippets
  const baseConfig = {
    command: 'npx',
    args: ['-y', packageId],
  };

  switch (tool) {
    case 'claudeCode':
      return {
        mcpServers: {
          [name.toLowerCase().replace(/\s+/g, '-')]: baseConfig,
        },
      };
    case 'cursor':
      return {
        mcp: {
          servers: {
            [name.toLowerCase().replace(/\s+/g, '-')]: baseConfig,
          },
        },
      };
    default:
      return baseConfig;
  }
}

/**
 * POST /cli/check-updates
 * Check for package updates
 */
const checkUpdates: RequestHandler = async (req, res, next) => {
  try {
    const { packages } = req.body as {
      packages: Array<{ name: string; currentVersion: string }>;
    };

    if (!packages || !Array.isArray(packages)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'packages array is required' },
      });
      return;
    }

    logger.debug({ packages }, 'Checking for updates');

    const updates: Array<{
      packageId: string;
      currentVersion: string;
      latestVersion: string;
      updateAvailable: boolean;
    }> = [];

    for (const pkg of packages) {
      try {
        const packageData = await packageService.getById(pkg.name);
        if (packageData) {
          const hasUpdate = semver.gt(packageData.latestVersion, pkg.currentVersion);
          updates.push({
            packageId: pkg.name,
            currentVersion: pkg.currentVersion,
            latestVersion: packageData.latestVersion,
            updateAvailable: hasUpdate,
          });
        }
      } catch {
        // Skip packages that can't be found
      }
    }

    res.json({
      success: true,
      data: {
        updates,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /cli/telemetry
 * Record CLI telemetry (fire-and-forget)
 */
const recordTelemetry: RequestHandler = async (req, res, next) => {
  try {
    const events = req.body;

    logger.debug({ eventCount: events?.length }, 'Recording telemetry');

    // TODO: Queue telemetry events for async processing
    // Don't wait for completion

    res.status(202).json({
      success: true,
    });
  } catch (error) {
    // Don't fail on telemetry errors
    logger.error({ error }, 'Telemetry recording failed');
    res.status(202).json({
      success: true,
    });
  }
};

/**
 * GET /cli/version
 * Check for CLI updates
 */
const checkVersion: RequestHandler = async (req, res, next) => {
  try {
    const currentVersion = req.query['version'] as string;
    const platform = req.query['platform'] as string;
    const arch = req.query['arch'] as string;

    logger.debug({ currentVersion, platform, arch }, 'Checking CLI version');

    // TODO: Implement version check
    res.json({
      success: true,
      data: {
        currentVersion: currentVersion ?? 'unknown',
        latestVersion: '0.1.0',
        updateAvailable: false,
        downloadUrl: null,
        releaseNotes: null,
        breaking: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

router.post('/resolve', resolvePackages);
router.post('/check-updates', checkUpdates);
router.post('/telemetry', recordTelemetry);
router.get('/version', checkVersion);

export { router as cliRouter };
