import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { ApiError } from './api-error.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

// =============================================================================
// Types
// =============================================================================

export interface CognitoJWTPayload extends JWTPayload {
  sub: string;
  'cognito:username': string;
  'cognito:groups'?: string[];
  email?: string;
  email_verified?: boolean;
  token_use: 'id' | 'access';
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  email?: string;
  emailVerified: boolean;
  groups: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      token?: string;
    }
  }
}

// =============================================================================
// JWKS Setup
// =============================================================================

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    const jwksUri = `https://cognito-idp.${config.aws.region}.amazonaws.com/${config.cognito.userPoolId}/.well-known/jwks.json`;
    jwks = createRemoteJWKSet(new URL(jwksUri));
  }
  return jwks;
}

// =============================================================================
// Token Extraction
// =============================================================================

function extractToken(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try cookie (for web sessions)
  const cookieToken = req.cookies?.accessToken;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

// =============================================================================
// Token Verification
// =============================================================================

async function verifyToken(token: string): Promise<CognitoJWTPayload> {
  const issuer = `https://cognito-idp.${config.aws.region}.amazonaws.com/${config.cognito.userPoolId}`;

  const { payload } = await jwtVerify(token, getJWKS(), {
    issuer,
    audience: config.cognito.clientId,
  });

  return payload as CognitoJWTPayload;
}

// =============================================================================
// Middleware: Authenticate (Required)
// =============================================================================

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw ApiError.unauthorized('Authentication required');
    }

    const payload = await verifyToken(token);

    // Map Cognito claims to user object
    req.user = {
      userId: payload.sub,
      username: payload['cognito:username'],
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      groups: payload['cognito:groups'] ?? [],
    };
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.debug({ error }, 'Token verification failed');
      next(ApiError.unauthorized('Invalid or expired token'));
    }
  }
}

// =============================================================================
// Middleware: Authenticate (Optional)
// =============================================================================

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (token) {
      const payload = await verifyToken(token);
      req.user = {
        userId: payload.sub,
        username: payload['cognito:username'],
        email: payload.email,
        emailVerified: payload.email_verified ?? false,
        groups: payload['cognito:groups'] ?? [],
      };
      req.token = token;
    }

    next();
  } catch (error) {
    // For optional auth, we just continue without user
    logger.debug({ error }, 'Optional auth: token verification failed');
    next();
  }
}

// =============================================================================
// Middleware: Require Group Membership
// =============================================================================

export function requireGroup(...requiredGroups: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }

    const userGroups = req.user.groups;
    const hasRequiredGroup = requiredGroups.some((group) =>
      userGroups.includes(group)
    );

    if (!hasRequiredGroup) {
      next(
        ApiError.forbidden(
          `Access denied. Required group: ${requiredGroups.join(' or ')}`
        )
      );
      return;
    }

    next();
  };
}

// =============================================================================
// Middleware: Require Publisher Status
// =============================================================================

export function requirePublisher(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(ApiError.unauthorized('Authentication required'));
    return;
  }

  const isPublisher =
    req.user.groups.includes('publishers') ||
    req.user.groups.includes('admins');

  if (!isPublisher) {
    next(
      ApiError.forbidden(
        'Publisher status required. Please apply to become a publisher.'
      )
    );
    return;
  }

  next();
}

// =============================================================================
// Middleware: Require Admin
// =============================================================================

export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(ApiError.unauthorized('Authentication required'));
    return;
  }

  if (!req.user.groups.includes('admins')) {
    next(ApiError.forbidden('Admin access required'));
    return;
  }

  next();
}

// =============================================================================
// Middleware: Require Verified Email
// =============================================================================

export function requireVerifiedEmail(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(ApiError.unauthorized('Authentication required'));
    return;
  }

  if (!req.user.emailVerified) {
    next(
      ApiError.forbidden('Email verification required. Please verify your email.')
    );
    return;
  }

  next();
}
