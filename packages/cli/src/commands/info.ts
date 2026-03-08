/**
 * Info Command
 */

import chalk from 'chalk';
import ora from 'ora';
import { RegistryClient } from '../core/registry-client.js';

interface InfoOptions {
  versions?: boolean;
  json?: boolean;
}

export async function infoCommand(packageId: string, options: InfoOptions): Promise<void> {
  const spinner = ora(`Fetching info for ${packageId}...`).start();
  const registry = new RegistryClient();

  try {
    const result = await registry.getPackage(packageId);

    spinner.stop();

    if (!result) {
      console.log(chalk.red(`Package '${packageId}' not found`));
      process.exit(1);
    }

    const p = result.package;

    if (options.json) {
      console.log(JSON.stringify(p, null, 2));
      return;
    }

    console.log();
    console.log(chalk.bold.cyan(p.packageId) + chalk.gray(` @ ${p.latestVersion || 'latest'}`));
    console.log(chalk.gray(p.description || p.shortDescription || ''));
    console.log();

    if (p.publisherName) {
      console.log(chalk.white('Publisher:   ') + p.publisherName);
    }
    if (p.license) {
      console.log(chalk.white('License:     ') + p.license);
    }
    if (p.category) {
      console.log(chalk.white('Category:    ') + p.category);
    }
    console.log(chalk.white('Downloads:   ') + (p.stats?.totalDownloads || 0).toLocaleString());

    const rating = p.stats?.averageRating;
    const reviewCount = p.stats?.reviewCount || 0;
    console.log(
      chalk.white('Rating:      ') +
        (rating
          ? `${rating.toFixed(1)}/5 (${reviewCount} reviews)`
          : 'No reviews yet')
    );
    console.log();

    if (p.capabilities && p.capabilities.length > 0) {
      console.log(chalk.white('Capabilities:'));
      for (const cap of p.capabilities) {
        console.log(`  - ${cap}`);
      }
      console.log();
    }

    if (p.tags && p.tags.length > 0) {
      console.log(chalk.white('Tags:        ') + p.tags.join(', '));
    }

    if (p.repository?.url) {
      console.log(chalk.white('Repository:  ') + p.repository.url);
    }

    console.log();
    console.log(chalk.gray('Install:'));
    console.log(chalk.cyan(`  mcp install ${p.packageId}`));
    console.log();
    console.log(chalk.gray('Or run directly with npx:'));
    console.log(chalk.cyan(`  npx -y ${p.packageId}`));
  } catch (error) {
    spinner.fail('Failed to fetch package info');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
