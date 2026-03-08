#!/usr/bin/env npx tsx
/**
 * MCP Seed Script
 *
 * Run this script to populate the database with real MCP servers from public sources.
 *
 * Usage:
 *   pnpm --filter @mcpsearch/worker seed
 *   pnpm --filter @mcpsearch/worker seed --sources=npm,github
 *   pnpm --filter @mcpsearch/worker seed --limit=50 --force
 */

import 'dotenv/config';
import pino from 'pino';
import { handleMcpIngestion, type IngestionPayload } from '../handlers/mcp-ingestion.js';

const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const payload: IngestionPayload = {
    sources: ['npm', 'github'],
    forceUpdate: false,
    outputMode: 'dynamodb',
  };

  for (const arg of args) {
    if (arg.startsWith('--sources=')) {
      const sources = arg.slice('--sources='.length).split(',');
      payload.sources = sources.filter(
        (s): s is 'npm' | 'github' | 'awesome' =>
          ['npm', 'github', 'awesome'].includes(s)
      );
    }
    if (arg.startsWith('--limit=')) {
      payload.limit = parseInt(arg.slice('--limit='.length), 10);
    }
    if (arg === '--force') {
      payload.forceUpdate = true;
    }
    if (arg === '--json') {
      payload.outputMode = 'json';
    }
    if (arg.startsWith('--output=')) {
      payload.outputPath = arg.slice('--output='.length);
      payload.outputMode = 'json';
    }
    if (arg === '--help' || arg === '-h') {
      console.log(`
MCP Seed Script - Populate database with real MCP servers

Usage:
  pnpm --filter @mcpsearch/worker seed [options]

Options:
  --sources=npm,github,awesome  Specify sources (default: npm,github)
  --limit=N                     Limit number of packages to ingest
  --force                       Force update existing packages
  --json                        Output to JSON file instead of DynamoDB
  --output=PATH                 Specify output JSON file path (implies --json)
  --help, -h                    Show this help message

Environment Variables:
  DYNAMODB_ENDPOINT             DynamoDB endpoint (default: http://localhost:4566)
  DYNAMODB_TABLE                DynamoDB table name (default: mcp-search-dev)
  LOG_LEVEL                     Logging level (default: info)

Examples:
  pnpm --filter @mcpsearch/worker seed
  pnpm --filter @mcpsearch/worker seed --sources=npm --limit=100
  pnpm --filter @mcpsearch/worker seed --sources=awesome --force
  pnpm --filter @mcpsearch/worker seed --json --output=./data/packages.json
`);
      process.exit(0);
    }
  }

  logger.info({ payload }, 'Starting MCP ingestion');

  try {
    const results = await handleMcpIngestion(payload, logger);

    // Summary
    console.log('\n=== Ingestion Summary ===\n');

    let totalIngested = 0;
    let totalErrors = 0;

    for (const result of results) {
      console.log(`Source: ${result.source}`);
      console.log(`  Total found: ${result.total}`);
      console.log(`  Ingested: ${result.ingested}`);
      console.log(`  Skipped: ${result.skipped}`);
      console.log(`  Errors: ${result.errors}`);
      console.log('');

      totalIngested += result.ingested;
      totalErrors += result.errors;
    }

    console.log(`Total packages ingested: ${totalIngested}`);
    console.log(`Total errors: ${totalErrors}`);

    if (totalIngested > 0) {
      console.log('\nPackages ingested:');
      for (const result of results) {
        if (result.packages.length > 0) {
          console.log(`\n  ${result.source}:`);
          for (const pkg of result.packages.slice(0, 20)) {
            console.log(`    - ${pkg}`);
          }
          if (result.packages.length > 20) {
            console.log(`    ... and ${result.packages.length - 20} more`);
          }
        }
      }
    }

    process.exit(totalErrors > 0 ? 1 : 0);
  } catch (error) {
    logger.error({ error }, 'Ingestion failed');
    process.exit(1);
  }
}

main();
