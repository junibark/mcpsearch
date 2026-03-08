/**
 * Init Command
 */

import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { ToolManager } from '../core/tool-manager.js';
import { ConfigManager } from '../core/config-manager.js';
import { SUPPORTED_TOOLS, type ToolId } from '@mcpsearch/shared';

interface InitOptions {
  tool?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const toolManager = new ToolManager();
  const config = new ConfigManager();

  try {
    let tool = options.tool as ToolId | undefined;

    if (!tool) {
      // Interactive selection
      const choices = Object.entries(SUPPORTED_TOOLS).map(([id, t]) => ({
        name: t.name,
        value: id as ToolId,
        description: `Config: ${t.configFile}`,
      }));

      tool = await select({
        message: 'Select a tool to configure:',
        choices,
      });
    }

    if (!SUPPORTED_TOOLS[tool]) {
      console.log(chalk.red(`Unknown tool: ${tool}`));
      console.log('Available tools:', Object.keys(SUPPORTED_TOOLS).join(', '));
      process.exit(1);
    }

    console.log(chalk.blue(`\nInitializing MCP configuration for ${SUPPORTED_TOOLS[tool].name}...`));

    await toolManager.initConfig(tool);
    config.setDefaultTool(tool);

    const configPath = toolManager.getConfigPath(tool);

    console.log(chalk.green('\nConfiguration initialized!'));
    console.log(chalk.gray(`Config file: ${configPath}`));
    console.log(chalk.gray(`Default tool set to: ${tool}`));
    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log('  1. Search for packages: mcp search <query>');
    console.log('  2. Install a package:   mcp install <package>');
    console.log('  3. List installed:      mcp list');
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
