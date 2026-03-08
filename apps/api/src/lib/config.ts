/**
 * Application Configuration
 *
 * Loads and validates configuration from environment variables.
 */

import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  API_VERSION: z.string().default('0.1.0'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // DynamoDB
  DYNAMODB_TABLE_NAME: z.string().default('mcp-search-main'),
  DYNAMODB_ENDPOINT: z.string().optional(), // For local development

  // S3
  S3_PACKAGES_BUCKET: z.string().default('mcp-search-packages'),
  S3_ASSETS_BUCKET: z.string().default('mcp-search-assets'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Cognito
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  COGNITO_REGION: z.string().default('us-east-1'),

  // OpenSearch
  OPENSEARCH_ENDPOINT: z.string().optional(),
  OPENSEARCH_INDEX: z.string().default('packages'),

  // Rate Limiting
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  const env = result.data;

  return {
    env: env.NODE_ENV,
    port: env.PORT,
    version: env.API_VERSION,
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',

    corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()),

    aws: {
      region: env.AWS_REGION,
      credentials:
        env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    },

    dynamodb: {
      tableName: env.DYNAMODB_TABLE_NAME,
      endpoint: env.DYNAMODB_ENDPOINT,
    },

    s3: {
      packagesBucket: env.S3_PACKAGES_BUCKET,
      assetsBucket: env.S3_ASSETS_BUCKET,
    },

    redis: {
      url: env.REDIS_URL,
    },

    cognito: {
      userPoolId: env.COGNITO_USER_POOL_ID,
      clientId: env.COGNITO_CLIENT_ID,
      region: env.COGNITO_REGION,
    },

    opensearch: {
      endpoint: env.OPENSEARCH_ENDPOINT,
      index: env.OPENSEARCH_INDEX,
    },

    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    },

    logLevel: env.LOG_LEVEL,
  };
}

export const config = loadConfig();
export type Config = typeof config;
