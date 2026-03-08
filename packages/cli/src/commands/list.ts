/**
 * List Command
 *
 * List installed MCP packages.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { ToolManager } from '../core/tool-manager.js';
import { ConfigManager } from '../core/config-manager.js';
import type { ToolId } from '@mcpsearch/shared';

interface ListOptions {
  tool?: string;
  outdated?: boolean;
  json?: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const toolManager = new ToolManager();
  const config = new ConfigManager();

  try {
    const tool = (options.tool ?? config.getDefaultTool()) as ToolId | undefined;

    // Get tools to list
    const toolsToList = tool
      ? [tool]
      : await toolManager.detectInstalledTools();

    if (toolsToList.length === 0) {
      console.log(chalk.yellow('No tools configured. Run "mcp init" to get started.'));
      return;
    }

    for (const t of toolsToList) {
      const packages = await toolManager.getInstalledPackages(t);

      if (packages.size === 0) {
        console.log(chalk.gray(`No MCP servers installed for ${t}`));
        continue;
      }

      console.log(chalk.blue(`\nMCP servers for ${t}:`));

      if (options.json) {
        const output: Record<string, unknown> = {};
        for (const [name, cfg] of packages) {
          output[name] = cfg;
        }
        console.log(JSON.stringify(output, null, 2));
      } else {
        const table = new Table({
          head: [chalk.white('Package'), chalk.white('Command')],
          colWidths: [40, 50],
        });

        for (const [name, cfg] of packages) {
          const cmd = cfg.args
            ? `${cfg.command} ${cfg.args.join(' ')}`
            : cfg.command;
          table.push([chalk.cyan(name), cmd]);
        }

        console.log(table.toString());
      }
    }
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
