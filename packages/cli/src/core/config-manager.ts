/**
 * Config Manager
 *
 * Manages CLI configuration storage.
 */

import Conf from 'conf';

interface CLIConfig {
  registry: string;
  defaultTool?: string;
  telemetryEnabled: boolean;
  authToken?: string;
  refreshToken?: string;
}

const defaults: CLIConfig = {
  registry: process.env['MCP_REGISTRY_URL'] || 'https://2bxybmyptk.us-east-1.awsapprunner.com',
  telemetryEnabled: true,
};

export class ConfigManager {
  private store: Conf<CLIConfig>;

  constructor() {
    this.store = new Conf<CLIConfig>({
      projectName: 'mcpsearch',
      defaults,
      schema: {
        registry: { type: 'string' },
        defaultTool: { type: 'string' },
        telemetryEnabled: { type: 'boolean' },
        authToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    });
  }

  /**
   * Get registry URL
   */
  getRegistryUrl(): string {
    return this.store.get('registry');
  }

  /**
   * Set registry URL
   */
  setRegistryUrl(url: string): void {
    this.store.set('registry', url);
  }

  /**
   * Get default tool
   */
  getDefaultTool(): string | undefined {
    return this.store.get('defaultTool');
  }

  /**
   * Set default tool
   */
  setDefaultTool(tool: string): void {
    this.store.set('defaultTool', tool);
  }

  /**
   * Check if telemetry is enabled
   */
  isTelemetryEnabled(): boolean {
    return this.store.get('telemetryEnabled');
  }

  /**
   * Set telemetry enabled
   */
  setTelemetryEnabled(enabled: boolean): void {
    this.store.set('telemetryEnabled', enabled);
  }

  /**
   * Get auth token
   */
  getAuthToken(): string | undefined {
    return this.store.get('authToken');
  }

  /**
   * Set auth tokens
   */
  setAuthTokens(accessToken: string, refreshToken: string): void {
    this.store.set('authToken', accessToken);
    this.store.set('refreshToken', refreshToken);
  }

  /**
   * Clear auth tokens
   */
  clearAuthTokens(): void {
    this.store.delete('authToken');
    this.store.delete('refreshToken');
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.store.get('authToken');
  }

  /**
   * Get a config value
   */
  get<K extends keyof CLIConfig>(key: K): CLIConfig[K] {
    return this.store.get(key);
  }

  /**
   * Set a config value
   */
  set<K extends keyof CLIConfig>(key: K, value: CLIConfig[K]): void {
    this.store.set(key, value);
  }

  /**
   * Get all config values
   */
  getAll(): CLIConfig {
    return this.store.store;
  }

  /**
   * Get config file path
   */
  getPath(): string {
    return this.store.path;
  }
}
