import chalk from 'chalk';
import ora from 'ora';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { getFormatter, type StatusInfo } from '../../lib/formatters.js';
import { buildPageStateFromFiles } from '../../lib/page-state.js';
import { readSpaceConfig } from '../../lib/space-config.js';
import { SyncEngine } from '../../lib/sync/index.js';

export interface StatusCommandOptions {
  xml?: boolean;
}

/**
 * Status command - shows connection and sync status
 */
export async function statusCommand(options: StatusCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();
  const formatter = getFormatter(options.xml || false);

  const status: StatusInfo = {
    configured: !!config,
    connected: false,
    initialized: false,
  };

  // If not configured, show message and exit
  if (!config) {
    console.log(formatter.formatStatus(status));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  status.confluenceUrl = config.confluenceUrl;
  status.email = config.email;

  // Check connection
  const spinner = options.xml ? null : ora('Checking connection...').start();

  try {
    const client = new ConfluenceClient(config);
    await client.verifyConnection();
    status.connected = true;
    spinner?.succeed('Connected to Confluence');
  } catch (_error) {
    status.connected = false;
    spinner?.fail('Not connected');
  }

  // Check space configuration
  const directory = process.cwd();
  const spaceConfig = readSpaceConfig(directory);

  if (spaceConfig) {
    status.initialized = true;
    status.spaceKey = spaceConfig.spaceKey;
    status.spaceName = spaceConfig.spaceName;
    status.lastSync = spaceConfig.lastSync;
    status.pageCount = Object.keys(spaceConfig.pages).length;

    // Check for pending changes if connected
    if (status.connected) {
      try {
        const syncEngine = new SyncEngine(config);
        const remotePages = await syncEngine.fetchPageTree(spaceConfig.spaceId);
        // Per ADR-0024: Build PageStateCache for version comparison from frontmatter
        const pageState = buildPageStateFromFiles(directory, spaceConfig.pages);
        const diff = syncEngine.computeDiff(remotePages, spaceConfig, pageState);

        status.pendingChanges = {
          added: diff.added.length,
          modified: diff.modified.length,
          deleted: diff.deleted.length,
        };
      } catch (_error) {
        // Ignore errors when checking pending changes
      }
    }
  }

  // Clear spinner if it's still running
  spinner?.stop();

  // Output status
  console.log('');
  console.log(formatter.formatStatus(status));
}
