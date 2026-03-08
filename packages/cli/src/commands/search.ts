/**
 * Search Command
 *
 * Search for MCP packages in the registry.
 */

import ora from 'ora';
import chalk from 'chalk';
import Table from 'cli-table3';
import { RegistryClient } from '../core/registry-client.js';

interface SearchOptions {
  category?: string;
  tool?: string;
  sort?: string;
  limit?: string;
}

export async function searchCommand(
  query: string,
  options: SearchOptions
): Promise<void> {
  const spinner = ora('Searching...').start();
  const registry = new RegistryClient();

  try {
    const results = await registry.search({
      q: query,
      category: options.category,
      tool: options.tool,
      sort: options.sort ?? 'downloads',
      limit: Number(options.limit) || 10,
    });

    spinner.stop();

    if (results.results.length === 0) {
      console.log(chalk.yellow(`No packages found for "${query}"`));
      return;
    }

    console.log(
      chalk.blue(`Found ${results.pagination.total} package(s) for "${query}":\n`)
    );

    const table = new Table({
      head: [
        chalk.white('Package'),
        chalk.white('Version'),
        chalk.white('Downloads'),
        chalk.white('Description'),
      ],
      colWidths: [35, 12, 12, 40],
      wordWrap: true,
    });

    for (const pkg of results.results) {
      const downloads = formatNumber(pkg.stats?.totalDownloads ?? 0);

      const verified = pkg.verificationStatus === 'official'
        ? chalk.blue(' [official]')
        : pkg.verificationStatus === 'verified'
        ? chalk.green(' [verified]')
        : '';

      table.push([
        chalk.cyan(pkg.packageId) + verified,
        pkg.latestVersion || 'latest',
        downloads,
        truncate(pkg.shortDescription || pkg.description || '', 40),
      ]);
    }

    console.log(table.toString());

    if (results.pagination.hasMore) {
      console.log(
        chalk.gray(`\nShowing ${results.results.length} of ${results.pagination.total} results`)
      );
    }

    console.log(chalk.gray('\nUse "mcp info <package>" to see details'));
    console.log(chalk.gray('Use "mcp install <package>" to install'));
  } catch (error) {
    spinner.fail('Search failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + '...';
}
