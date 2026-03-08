/**
 * Install Command
 *
 * Install MCP packages for configured tools.
 */

import ora from 'ora';
import chalk from 'chalk';
import { RegistryClient } from '../core/registry-client.js';
import { ToolManager } from '../core/tool-manager.js';
import { ConfigManager } from '../core/config-manager.js';
import { parsePackageSpec } from '../core/utils.js';
import type { ToolId } from '@mcpsearch/shared';

interface InstallOptions {
  tool?: string;
  global?: boolean;
  saveDev?: boolean;
}

export async function installCommand(
  packages: string[],
  options: InstallOptions
): Promise<void> {
  const spinner = ora();
  const registry = new RegistryClient();
  const config = new ConfigManager();
  const toolManager = new ToolManager();

  try {
    // Determine target tool
    let tool = options.tool ?? config.getDefaultTool();

    if (!tool) {
      console.log(chalk.yellow('No tool specified. Detecting installed tools...'));
      const detectedTools = await toolManager.detectInstalledTools();

      if (detectedTools.length === 0) {
        console.log(
          chalk.red('No supported tools detected. Use --tool to specify one.')
        );
        console.log(chalk.gray('Supported tools: claudeCode, cursor, windsurf, continueDev'));
        process.exit(1);
      }

      if (detectedTools.length === 1) {
        tool = detectedTools[0];
        console.log(chalk.green(`Detected: ${tool}`));
      } else {
        console.log(chalk.yellow('Multiple tools detected. Use --tool to specify one.'));
        console.log('Available:', detectedTools.join(', '));
        process.exit(1);
      }
    }

    console.log(chalk.blue(`\nInstalling for ${tool}...\n`));

    // Parse package specifications
    const specs = packages.map(parsePackageSpec);

    // Validate and install each package
    let installedCount = 0;

    for (const spec of specs) {
      spinner.start(`Looking up ${chalk.cyan(spec.name)}...`);

      try {
        // Look up package in registry
        const pkgInfo = await registry.getPackageInfo(spec.name);

        if (!pkgInfo) {
          spinner.warn(`Package ${chalk.cyan(spec.name)} not found in registry, using npm...`);
          // Still add it - it might be a valid npm package
        } else {
          spinner.text = `Installing ${chalk.cyan(pkgInfo.packageId)}@${spec.version || pkgInfo.latestVersion}...`;
        }

        const packageId = pkgInfo?.packageId ?? spec.name;
        const version = spec.version || pkgInfo?.latestVersion || 'latest';

        // Add to tool configuration
        await toolManager.addPackage(tool as ToolId, {
          packageId,
          version,
        });

        spinner.succeed(`Installed ${chalk.cyan(packageId)}@${version}`);
        installedCount++;
      } catch (error) {
        spinner.fail(`Failed to install ${spec.name}`);
        console.error(chalk.red(`  ${(error as Error).message}`));
      }
    }

    if (installedCount > 0) {
      console.log(chalk.green(`\nSuccessfully installed ${installedCount} package(s)`));

      // Show post-install instructions
      console.log(chalk.gray('\nRestart your tool to load the new MCP servers.'));

      // Show tool-specific instructions
      if (tool === 'claudeCode') {
        console.log(chalk.gray('Run "claude" to start Claude Code with the new MCP servers.'));
      } else if (tool === 'cursor') {
        console.log(chalk.gray('Restart Cursor to load the new MCP servers.'));
      }
    } else {
      console.log(chalk.yellow('\nNo packages were installed.'));
    }
  } catch (error) {
    spinner.fail('Installation failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
