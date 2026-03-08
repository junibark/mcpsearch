/**
 * MCPSearch CLI
 *
 * Command-line tool for discovering and installing MCP servers.
 */

import { program } from 'commander';
import { version } from '../package.json';
import { searchCommand } from './commands/search.js';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { removeCommand } from './commands/remove.js';
import { updateCommand } from './commands/update.js';
import { infoCommand } from './commands/info.js';
import { initCommand } from './commands/init.js';
import { loginCommand } from './commands/login.js';
import { publishCommand } from './commands/publish.js';
import { configCommand } from './commands/config.js';

program
  .name('mcp')
  .description('MCPSearch CLI - Discover and install MCP servers')
  .version(version);

// Search command
program
  .command('search <query>')
  .description('Search for MCP packages')
  .option('-c, --category <category>', 'Filter by category')
  .option('-t, --tool <tool>', 'Filter by tool compatibility')
  .option('-s, --sort <sort>', 'Sort by: downloads, recent, rating', 'downloads')
  .option('-l, --limit <limit>', 'Number of results', '10')
  .action(searchCommand);

// Install command
program
  .command('install <packages...>')
  .alias('i')
  .alias('add')
  .description('Install MCP packages')
  .option('-t, --tool <tool>', 'Target tool (claudeCode, cursor, windsurf, continueDev)')
  .option('-g, --global', 'Install globally')
  .option('--save-dev', 'Save as dev dependency')
  .action(installCommand);

// List command
program
  .command('list')
  .alias('ls')
  .description('List installed MCP packages')
  .option('-t, --tool <tool>', 'Filter by tool')
  .option('-o, --outdated', 'Show only outdated packages')
  .option('-j, --json', 'Output as JSON')
  .action(listCommand);

// Remove command
program
  .command('remove <packages...>')
  .alias('rm')
  .alias('uninstall')
  .description('Remove MCP packages')
  .option('-t, --tool <tool>', 'Target tool')
  .action(removeCommand);

// Update command
program
  .command('update [packages...]')
  .alias('up')
  .description('Update MCP packages')
  .option('-t, --tool <tool>', 'Target tool')
  .option('--dry-run', 'Show what would be updated')
  .action(updateCommand);

// Info command
program
  .command('info <package>')
  .description('Show package details')
  .option('-v, --versions', 'Show all versions')
  .option('-j, --json', 'Output as JSON')
  .action(infoCommand);

// Init command
program
  .command('init')
  .description('Initialize MCP configuration for a tool')
  .option('-t, --tool <tool>', 'Target tool')
  .action(initCommand);

// Login command
program
  .command('login')
  .description('Authenticate with MCPSearch')
  .option('--token <token>', 'API token for non-interactive login')
  .action(loginCommand);

// Publish command
program
  .command('publish [path]')
  .description('Publish a package to MCPSearch')
  .option('--dry-run', 'Validate without publishing')
  .option('--tag <tag>', 'Publish with a specific tag', 'latest')
  .action(publishCommand);

// Config command
program
  .command('config <action> [key] [value]')
  .description('Manage CLI configuration')
  .action(configCommand);

// Parse arguments
program.parse();
