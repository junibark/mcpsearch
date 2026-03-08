/**
 * Config Command
 */

import chalk from 'chalk';
import { ConfigManager } from '../core/config-manager.js';

export async function configCommand(
  action: string,
  key?: string,
  value?: string
): Promise<void> {
  const config = new ConfigManager();

  try {
    switch (action) {
      case 'get': {
        if (!key) {
          console.log(chalk.red('Key is required'));
          process.exit(1);
        }
        const val = config.get(key as keyof ReturnType<typeof config.getAll>);
        if (val !== undefined) {
          console.log(val);
        } else {
          console.log(chalk.gray('(not set)'));
        }
        break;
      }

      case 'set': {
        if (!key || value === undefined) {
          console.log(chalk.red('Key and value are required'));
          process.exit(1);
        }

        // Handle different config keys
        switch (key) {
          case 'registry':
            config.setRegistryUrl(value);
            break;
          case 'defaultTool':
            config.setDefaultTool(value);
            break;
          case 'telemetry':
            config.setTelemetryEnabled(value === 'true');
            break;
          default:
            console.log(chalk.red(`Unknown config key: ${key}`));
            process.exit(1);
        }

        console.log(chalk.green(`Set ${key} = ${value}`));
        break;
      }

      case 'list': {
        const all = config.getAll();
        console.log(chalk.blue('Current configuration:'));
        console.log();
        for (const [k, v] of Object.entries(all)) {
          if (k === 'authToken' || k === 'refreshToken') {
            console.log(`  ${k}: ${v ? chalk.gray('[set]') : chalk.gray('(not set)')}`);
          } else {
            console.log(`  ${k}: ${v ?? chalk.gray('(not set)')}`);
          }
        }
        console.log();
        console.log(chalk.gray(`Config file: ${config.getPath()}`));
        break;
      }

      case 'path': {
        console.log(config.getPath());
        break;
      }

      default:
        console.log(chalk.red(`Unknown action: ${action}`));
        console.log('Available actions: get, set, list, path');
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
