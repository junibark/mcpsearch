/**
 * Login Command
 */

import chalk from 'chalk';
import { ConfigManager } from '../core/config-manager.js';

interface LoginOptions {
  token?: string;
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  const config = new ConfigManager();

  try {
    if (options.token) {
      // Non-interactive login with token
      config.setAuthTokens(options.token, '');
      console.log(chalk.green('Successfully logged in!'));
      return;
    }

    // Interactive login - open browser
    console.log(chalk.blue('Opening browser for authentication...'));
    console.log(chalk.gray('(Browser-based OAuth coming soon)'));
    console.log();
    console.log('For now, use: mcp login --token <your-api-token>');
    console.log('Get your API token from: https://mcpsearch.com/settings/tokens');
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
