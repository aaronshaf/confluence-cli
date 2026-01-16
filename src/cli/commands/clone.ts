import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { SyncEngine } from '../../lib/sync/index.js';

export interface CloneCommandOptions {
  spaceKey: string;
  directory?: string;
}

/**
 * Clone command - clones a Confluence space to a new local directory
 */
export async function cloneCommand(options: CloneCommandOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Please run "cn setup" first.'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const syncEngine = new SyncEngine(config);

  // Determine target directory
  const targetDir = options.directory || options.spaceKey;
  const fullPath = resolve(process.cwd(), targetDir);

  // Check if directory already exists
  if (existsSync(fullPath)) {
    console.error(chalk.red(`Directory "${targetDir}" already exists.`));
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }

  const spinner = ora({
    text: `Cloning space ${options.spaceKey} into ${targetDir}...`,
    hideCursor: false,
    discardStdin: false,
  }).start();

  try {
    // Create directory
    mkdirSync(fullPath, { recursive: true });

    // Initialize space config
    const spaceConfig = await syncEngine.initSync(fullPath, options.spaceKey);
    spinner.succeed(`Cloned space "${spaceConfig.spaceName}" (${spaceConfig.spaceKey}) into ${targetDir}`);

    console.log('');
    console.log(chalk.gray(`  cd ${targetDir}`));
    console.log(chalk.gray('  cn pull'));
  } catch (error) {
    spinner.fail('Failed to clone space');

    // Clean up directory on failure
    if (existsSync(fullPath)) {
      try {
        rmSync(fullPath, { recursive: true });
      } catch {
        // Ignore cleanup errors - directory may be partially created
      }
    }

    if (error instanceof Error && error.message.includes('not found')) {
      console.error(chalk.red(`\nSpace "${options.spaceKey}" not found.`));
      console.log(chalk.gray('Check the space key and try again.'));
      process.exit(EXIT_CODES.SPACE_NOT_FOUND);
    }

    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}
