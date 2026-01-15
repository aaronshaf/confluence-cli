#!/usr/bin/env bun
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT_CODES } from '../lib/errors.js';
import { openCommand } from './commands/open.js';
import { setup } from './commands/setup.js';
import { statusCommand } from './commands/status.js';
import { syncCommand } from './commands/sync.js';
import { treeCommand } from './commands/tree.js';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

function showSetupHelp(): void {
  console.log(`
${chalk.bold('cn setup - Configure Confluence credentials')}

${chalk.yellow('Usage:')}
  cn setup

${chalk.yellow('Description:')}
  Interactive setup wizard that configures:
  - Confluence Cloud URL (https://*.atlassian.net)
  - Email address
  - API token (create at https://id.atlassian.com/manage/api-tokens)

  Stores configuration securely in ~/.cn/config.json with 600 permissions.

${chalk.yellow('Options:')}
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn setup                  Start interactive setup
`);
}

function showSyncHelp(): void {
  console.log(`
${chalk.bold('cn sync - Sync Confluence space to local folder')}

${chalk.yellow('Usage:')}
  cn sync [options]
  cn sync --init <SPACE_KEY>

${chalk.yellow('Description:')}
  Syncs a Confluence space to the current directory.
  Use --init to initialize sync for a new space.

${chalk.yellow('Sync Modes:')}
  ${chalk.cyan('Smart sync (default)')}
    Only syncs pages that have changed since last sync.
    Compares version numbers to detect modifications.
    Handles renames and moves automatically.

  ${chalk.cyan('Full sync (--force)')}
    Re-downloads all pages regardless of local state.
    Use when local state may be corrupted or out of sync.

${chalk.yellow('Options:')}
  --init <SPACE_KEY>        Initialize sync for a space
  --dry-run                 Show what would be synced without making changes
  --force                   Full re-sync, ignore local state
  --depth <n>               Limit sync depth
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn sync --init DOCS       Initialize sync for DOCS space
  cn sync                   Smart sync (only changes)
  cn sync --dry-run         Preview changes
  cn sync --force           Full re-sync all pages
`);
}

function showStatusHelp(): void {
  console.log(`
${chalk.bold('cn status - Check connection and sync status')}

${chalk.yellow('Usage:')}
  cn status [options]

${chalk.yellow('Description:')}
  Shows the current configuration, connection status, and sync state.

${chalk.yellow('Options:')}
  --xml                     Output in XML format for LLM parsing
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn status                 Show status with colored output
  cn status --xml           Show status in XML format
`);
}

function showTreeHelp(): void {
  console.log(`
${chalk.bold('cn tree - Display page hierarchy')}

${chalk.yellow('Usage:')}
  cn tree [space-key] [options]

${chalk.yellow('Description:')}
  Displays the page hierarchy for a space as an ASCII tree.
  If no space key is provided, uses the space in the current directory.

${chalk.yellow('Options:')}
  --remote                  Fetch live from API (default)
  --local                   Use cached sync state
  --depth <n>               Limit tree depth
  --xml                     Output in XML format for LLM parsing
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn tree                   Show tree for current directory's space
  cn tree DOCS              Show tree for DOCS space
  cn tree --depth 2         Limit to 2 levels deep
  cn tree --xml             Output in XML format
`);
}

function showOpenHelp(): void {
  console.log(`
${chalk.bold('cn open - Open page in browser')}

${chalk.yellow('Usage:')}
  cn open [page]
  cn open [options]

${chalk.yellow('Description:')}
  Opens a Confluence page in your default browser.
  Without arguments, opens the space home page.

${chalk.yellow('Arguments:')}
  page                      Page title, file path, or page ID

${chalk.yellow('Options:')}
  --space <key>             Specify space key
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn open                   Open space home
  cn open "Getting Started" Open page by title
  cn open ./docs/page.md    Open page from local file
  cn open 123456789         Open page by ID
`);
}

function showHelp(): void {
  console.log(`
${chalk.bold('cn - Confluence CLI')}

Sync Confluence spaces to local markdown files.

${chalk.yellow('Commands:')}
  cn setup                  Configure Confluence credentials
  cn sync                   Sync space to local folder
  cn status                 Check connection and sync status
  cn tree                   Display page hierarchy
  cn open                   Open page in browser

${chalk.yellow('Global Options:')}
  --help, -h                Show help message
  --version, -v             Show version number
  --verbose                 Enable verbose output
  --xml                     Output in XML format (where supported)

${chalk.yellow('Environment Variables:')}
  CN_CONFIG_PATH            Override config file location
  CN_DEBUG                  Enable debug logging
  NO_COLOR                  Disable colored output

${chalk.yellow('Examples:')}
  cn setup                  Configure credentials
  cn sync --init DOCS       Initialize sync for DOCS space
  cn sync                   Sync changes
  cn tree                   Show page hierarchy
  cn open "My Page"         Open page in browser

${chalk.gray('For more information on a command, run: cn <command> --help')}
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle no arguments or help
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }

  // Handle version
  if (args[0] === '--version' || args[0] === '-v') {
    console.log(`cn version ${VERSION}`);
    process.exit(EXIT_CODES.SUCCESS);
  }

  const command = args[0];
  const subArgs = args.slice(1);

  // Check for verbose mode
  const verbose = args.includes('--verbose');
  if (verbose && process.env.CN_DEBUG !== '1') {
    process.env.CN_DEBUG = '1';
  }

  try {
    switch (command) {
      case 'setup':
        if (args.includes('--help')) {
          showSetupHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        await setup();
        break;

      case 'sync': {
        if (args.includes('--help')) {
          showSyncHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }

        // Parse sync options
        const initIndex = args.indexOf('--init');
        const spaceKey = initIndex !== -1 && initIndex + 1 < args.length ? args[initIndex + 1] : undefined;

        const dryRun = args.includes('--dry-run');
        const force = args.includes('--force');

        let depth: number | undefined;
        const depthIndex = args.indexOf('--depth');
        if (depthIndex !== -1 && depthIndex + 1 < args.length) {
          depth = Number.parseInt(args[depthIndex + 1], 10);
        }

        await syncCommand({
          init: spaceKey,
          dryRun,
          force,
          depth,
        });
        break;
      }

      case 'status':
        if (args.includes('--help')) {
          showStatusHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        await statusCommand({ xml: args.includes('--xml') });
        break;

      case 'tree': {
        if (args.includes('--help')) {
          showTreeHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }

        // Find space key (first non-flag argument)
        const spaceKey = subArgs.find((arg) => !arg.startsWith('--'));

        let depth: number | undefined;
        const depthIndex = args.indexOf('--depth');
        if (depthIndex !== -1 && depthIndex + 1 < args.length) {
          depth = Number.parseInt(args[depthIndex + 1], 10);
        }

        await treeCommand({
          spaceKey,
          remote: args.includes('--remote') || !args.includes('--local'),
          depth,
          xml: args.includes('--xml'),
        });
        break;
      }

      case 'open': {
        if (args.includes('--help')) {
          showOpenHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }

        // Find page argument (first non-flag argument)
        const page = subArgs.find((arg) => !arg.startsWith('--'));

        let spaceKey: string | undefined;
        const spaceIndex = args.indexOf('--space');
        if (spaceIndex !== -1 && spaceIndex + 1 < args.length) {
          spaceKey = args[spaceIndex + 1];
        }

        await openCommand({ page, spaceKey });
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "cn help" for usage information');
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(EXIT_CODES.GENERAL_ERROR);
});
