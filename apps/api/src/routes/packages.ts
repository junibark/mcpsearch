/**
 * Package Routes
 *
 * CRUD operations for MCP packages.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import {
  createPackageSchema,
  publishVersionSchema,
  updatePackageSchema,
} from '@mcpsearch/shared';
import { packageService } from '../services/package-service.js';
import { ApiError } from '../middleware/api-error.js';
import { authenticate, optionalAuth, requirePublisher } from '../middleware/auth.js';
import { validateBody, validateQuery, paginationSchema } from '../middleware/validate.js';
import { apiRateLimit, downloadRateLimit, publishRateLimit } from '../middleware/rate-limit.js';
import { z } from 'zod';

const router = Router();

// =============================================================================
// Query Schemas
// =============================================================================

const listPackagesQuerySchema = z.object({
  category: z.string().optional(),
  publisherId: z.string().optional(),
  status: z.enum(['published', 'pending', 'deprecated']).optional(),
  sort: z.enum(['downloads', 'rating', 'recent']).optional(),
  cursor: z.string().optional(),
  ...paginationSchema.shape,
});

// =============================================================================
// GET /packages - List packages
// =============================================================================

const listPackages: RequestHandler = async (req, res, next) => {
  try {
    const query = listPackagesQuerySchema.parse(req.query);
    const result = await packageService.list({
      category: query.category,
      publisherId: query.publisherId,
      status: query.status,
      sort: query.sort,
      limit: query.limit,
      cursor: query.cursor,
    });

    res.json({
      success: true,
      data: {
        packages: result.packages,
        nextCursor: result.nextCursor,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /packages/featured - Get featured packages
// =============================================================================

const getFeatured: RequestHandler = async (_req, res, next) => {
  try {
    const packages = await packageService.listFeatured(10);
    res.json({
      success: true,
      data: packages,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /packages/popular - Get popular packages
// =============================================================================

const getPopular: RequestHandler = async (_req, res, next) => {
  try {
    const packages = await packageService.listPopular(10);
    res.json({
      success: true,
      data: packages,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /packages/recent - Get recent packages
// =============================================================================

const getRecent: RequestHandler = async (_req, res, next) => {
  try {
    const packages = await packageService.listRecent(10);
    res.json({
      success: true,
      data: packages,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /packages/:packageId - Get package details
// =============================================================================

const getPackage: RequestHandler = async (req, res, next) => {
  try {
    const packageId = decodeURIComponent(req.params.packageId);

    if (!packageId) {
      throw ApiError.badRequest('Package ID is required');
    }

    const pkg = await packageService.getById(packageId);

    if (!pkg) {
      throw ApiError.packageNotFound(packageId);
    }

    // Get versions for this package
    const versions = await packageService.getVersions(packageId);

    res.json({
      success: true,
      data: {
        ...pkg,
        versions: versions.slice(0, 10), // Latest 10 versions
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /packages/:packageId/versions - List package versions
// =============================================================================

const getVersions: RequestHandler = async (req, res, next) => {
  try {
    const packageId = decodeURIComponent(req.params.packageId);

    if (!packageId) {
      throw ApiError.badRequest('Package ID is required');
    }

    const versions = await packageService.getVersions(packageId);

    res.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /packages/:packageId/versions/:version - Get specific version
// =============================================================================

const getVersion: RequestHandler = async (req, res, next) => {
  try {
    const packageId = decodeURIComponent(req.params.packageId);
    const { version } = req.params;

    if (!packageId || !version) {
      throw ApiError.badRequest('Package ID and version are required');
    }

    const versionData = await packageService.getVersion(packageId, version);

    if (!versionData) {
      throw ApiError.versionNotFound(packageId, version);
    }

    res.json({
      success: true,
      data: versionData,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GET /packages/:packageId/download - Download package (latest or specific version)
// =============================================================================

const downloadPackage: RequestHandler = async (req, res, next) => {
  try {
    const packageId = decodeURIComponent(req.params.packageId);
    const version = req.query.version as string | undefined;

    if (!packageId) {
      throw ApiError.badRequest('Package ID is required');
    }

    const { url, version: resolvedVersion } = await packageService.getDownloadUrl(
      packageId,
      version
    );

    // Set headers for download tracking
    res.setHeader('X-Package-Id', packageId);
    res.setHeader('X-Package-Version', resolvedVersion);

    // Redirect to S3 presigned URL
    res.redirect(302, url);
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// POST /packages - Create new package
// =============================================================================

const createPackage: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const input = createPackageSchema.parse(req.body);
    const pkg = await packageService.create(input, req.user.userId);

    res.status(201).json({
      success: true,
      data: pkg,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// PATCH /packages/:packageId - Update package
// =============================================================================

const updatePackage: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const packageId = decodeURIComponent(req.params.packageId);
    const input = updatePackageSchema.parse(req.body);

    const pkg = await packageService.update(packageId, input, req.user.userId);

    if (!pkg) {
      throw ApiError.packageNotFound(packageId);
    }

    res.json({
      success: true,
      data: pkg,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// DELETE /packages/:packageId - Deprecate package
// =============================================================================

const deprecatePackage: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const packageId = decodeURIComponent(req.params.packageId);

    await packageService.deprecate(packageId, req.user.userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// POST /packages/:packageId/versions - Publish new version
// =============================================================================

const publishVersion: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const packageId = decodeURIComponent(req.params.packageId);
    const input = publishVersionSchema.parse(req.body);

    const version = await packageService.publishVersion(
      packageId,
      input,
      req.user.userId
    );

    res.status(201).json({
      success: true,
      data: version,
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// POST /packages/:packageId/versions/:version/upload-url - Get upload URL
// =============================================================================

const getUploadUrl: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const packageId = decodeURIComponent(req.params.packageId);
    const { version } = req.params;

    const { url, key } = await packageService.getUploadUrl(
      packageId,
      version,
      req.user.userId
    );

    res.json({
      success: true,
      data: { uploadUrl: url, key },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// Register Routes
// =============================================================================

// Public routes
router.get('/', apiRateLimit, listPackages);
router.get('/featured', apiRateLimit, getFeatured);
router.get('/popular', apiRateLimit, getPopular);
router.get('/recent', apiRateLimit, getRecent);
router.get('/:packageId', apiRateLimit, optionalAuth, getPackage);
router.get('/:packageId/versions', apiRateLimit, getVersions);
router.get('/:packageId/versions/:version', apiRateLimit, getVersion);
router.get('/:packageId/download', downloadRateLimit, downloadPackage);

// Protected routes
router.post('/', publishRateLimit, authenticate, requirePublisher, createPackage);
router.patch('/:packageId', apiRateLimit, authenticate, updatePackage);
router.delete('/:packageId', apiRateLimit, authenticate, deprecatePackage);
router.post('/:packageId/versions', publishRateLimit, authenticate, requirePublisher, publishVersion);
router.post(
  '/:packageId/versions/:version/upload-url',
  publishRateLimit,
  authenticate,
  requirePublisher,
  getUploadUrl
);

export { router as packagesRouter };
