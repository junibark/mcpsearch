/**
 * Tool Manager
 *
 * Manages MCP server configurations for different tools.
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { SUPPORTED_TOOLS, type ToolId } from '@mcpsearch/shared';

interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface PackageInfo {
  packageId: string;
  version: string;
  config?: Partial<MCPServerConfig>;
}

export class ToolManager {
  private home: string;

  constructor() {
    this.home = homedir();
  }

  /**
   * Detect which tools are installed
   */
  async detectInstalledTools(): Promise<ToolId[]> {
    const detected: ToolId[] = [];

    for (const [toolId, toolConfig] of Object.entries(SUPPORTED_TOOLS)) {
      const configPath = this.getConfigPath(toolId as ToolId);

      try {
        await access(configPath);
        detected.push(toolId as ToolId);
      } catch {
        // Config file doesn't exist, tool not configured
      }
    }

    return detected;
  }

  /**
   * Get the config file path for a tool
   */
  getConfigPath(tool: ToolId): string {
    const toolConfig = SUPPORTED_TOOLS[tool];
    return join(this.home, toolConfig.configFile);
  }

  /**
   * Read tool configuration
   */
  async readConfig(tool: ToolId): Promise<Record<string, unknown>> {
    const configPath = this.getConfigPath(tool);

    try {
      const content = await readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * Write tool configuration
   */
  async writeConfig(tool: ToolId, config: Record<string, unknown>): Promise<void> {
    const configPath = this.getConfigPath(tool);

    // Ensure directory exists
    await mkdir(dirname(configPath), { recursive: true });

    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Get installed MCP servers for a tool
   */
  async getInstalledPackages(tool: ToolId): Promise<Map<string, MCPServerConfig>> {
    const config = await this.readConfig(tool);
    const toolConfig = SUPPORTED_TOOLS[tool];

    // Navigate to the MCP servers section
    let servers: Record<string, MCPServerConfig> = {};

    // Different tools store configs differently
    if (tool === 'claudeCode') {
      servers = (config['mcpServers'] as Record<string, MCPServerConfig>) ?? {};
    } else if (tool === 'cursor' || tool === 'windsurf') {
      servers = (config['servers'] as Record<string, MCPServerConfig>) ?? {};
    } else if (tool === 'continueDev') {
      servers = (config['mcpServers'] as Record<string, MCPServerConfig>) ?? {};
    }

    return new Map(Object.entries(servers));
  }

  /**
   * Add a package to tool configuration
   */
  async addPackage(tool: ToolId, pkg: PackageInfo): Promise<void> {
    const config = await this.readConfig(tool);

    // Get or create the servers section
    const serversKey = tool === 'claudeCode' || tool === 'continueDev'
      ? 'mcpServers'
      : 'servers';

    if (!config[serversKey]) {
      config[serversKey] = {};
    }

    const servers = config[serversKey] as Record<string, MCPServerConfig>;

    // Generate server config
    // This would typically come from the package manifest
    servers[pkg.packageId] = {
      command: 'npx',
      args: ['-y', pkg.packageId],
      ...pkg.config,
    };

    await this.writeConfig(tool, config);
  }

  /**
   * Remove a package from tool configuration
   */
  async removePackage(tool: ToolId, packageId: string): Promise<boolean> {
    const config = await this.readConfig(tool);

    const serversKey = tool === 'claudeCode' || tool === 'continueDev'
      ? 'mcpServers'
      : 'servers';

    const servers = config[serversKey] as Record<string, MCPServerConfig> | undefined;

    if (!servers || !(packageId in servers)) {
      return false;
    }

    delete servers[packageId];
    await this.writeConfig(tool, config);
    return true;
  }

  /**
   * Initialize configuration for a tool
   */
  async initConfig(tool: ToolId): Promise<void> {
    const configPath = this.getConfigPath(tool);

    // Check if config already exists
    try {
      await access(configPath);
      // Config exists, don't overwrite
      return;
    } catch {
      // Config doesn't exist, create it
    }

    const serversKey = tool === 'claudeCode' || tool === 'continueDev'
      ? 'mcpServers'
      : 'servers';

    const initialConfig = {
      [serversKey]: {},
    };

    await this.writeConfig(tool, initialConfig);
  }
}
