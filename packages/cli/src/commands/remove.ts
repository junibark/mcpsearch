/**
 * Remove Command
 */

import chalk from 'chalk';
import ora from 'ora';
import { ToolManager } from '../core/tool-manager.js';
import { ConfigManager } from '../core/config-manager.js';
import type { ToolId } from '@mcpsearch/shared';

interface RemoveOptions {
  tool?: string;
}

export async function removeCommand(packages: string[], options: RemoveOptions): Promise<void> {
  const spinner = ora();
  const toolManager = new ToolManager();
  const config = new ConfigManager();

  try {
    const tool = (options.tool ?? config.getDefaultTool()) as ToolId | undefined;

    if (!tool) {
      console.log(chalk.red('No tool specified. Use --tool to specify one.'));
      process.exit(1);
    }

    for (const pkg of packages) {
      spinner.start(`Removing ${chalk.cyan(pkg)}...`);

      const removed = await toolManager.removePackage(tool, pkg);

      if (removed) {
        spinner.succeed(`Removed ${chalk.cyan(pkg)}`);
      } else {
        spinner.warn(`${chalk.cyan(pkg)} was not installed`);
      }
    }

    console.log(chalk.green('\nDone. Restart your tool to apply changes.'));
  } catch (error) {
    spinner.fail('Remove failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
