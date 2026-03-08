/**
 * Update Command
 */

import chalk from 'chalk';
import ora from 'ora';
import { RegistryClient } from '../core/registry-client.js';
import { ToolManager } from '../core/tool-manager.js';
import { ConfigManager } from '../core/config-manager.js';
import type { ToolId } from '@mcpsearch/shared';

interface UpdateOptions {
  tool?: string;
  dryRun?: boolean;
}

export async function updateCommand(
  packages: string[] | undefined,
  options: UpdateOptions
): Promise<void> {
  const spinner = ora();
  const registry = new RegistryClient();
  const toolManager = new ToolManager();
  const config = new ConfigManager();

  try {
    const tool = (options.tool ?? config.getDefaultTool()) as ToolId | undefined;

    if (!tool) {
      console.log(chalk.red('No tool specified. Use --tool to specify one.'));
      process.exit(1);
    }

    spinner.start('Checking for updates...');

    const installed = await toolManager.getInstalledPackages(tool);

    if (installed.size === 0) {
      spinner.info('No packages installed');
      return;
    }

    // Filter to specified packages if provided
    const toCheck = packages?.length
      ? Array.from(installed.keys()).filter((p) => packages.includes(p))
      : Array.from(installed.keys());

    // TODO: Get versions from installed packages
    const updates = await registry.checkUpdates(
      toCheck.map((p) => ({ packageId: p, currentVersion: '0.0.0' }))
    );

    spinner.stop();

    if (updates.length === 0) {
      console.log(chalk.green('All packages are up to date!'));
      return;
    }

    console.log(chalk.blue(`\nUpdates available:\n`));

    for (const update of updates) {
      console.log(
        `  ${chalk.cyan(update.packageId)}: ` +
          `${chalk.gray(update.currentVersion)} -> ${chalk.green(update.latestVersion)} ` +
          `(${update.updateType})`
      );
    }

    if (options.dryRun) {
      console.log(chalk.gray('\nDry run - no changes made'));
      return;
    }

    // TODO: Implement actual update
    console.log(chalk.yellow('\nUpdate functionality coming soon!'));
  } catch (error) {
    spinner.fail('Update check failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
