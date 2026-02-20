#!/usr/bin/env bun
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT_CODES } from '../lib/errors.js';
import {
  showAttachmentsHelp,
  showCloneHelp,
  showCommentsHelp,
  showCreateHelp,
  showDeleteHelp,
  showDoctorHelp,
  showHelp,
  showInfoHelp,
  showLabelsHelp,
  showMoveHelp,
  showOpenHelp,
  showFolderHelp,
  showPullHelp,
  showSearchHelp,
  showSetupHelp,
  showSpacesHelp,
  showStatusHelp,
  showTreeHelp,
  showUpdateHelp,
} from './help.js';
import { attachmentsCommand } from './commands/attachments.js';
import { cloneCommand } from './commands/clone.js';
import { commentsCommand } from './commands/comments.js';
import { createCommand } from './commands/create.js';
import { deleteCommand } from './commands/delete.js';
import { doctorCommand } from './commands/doctor.js';
import { infoCommand } from './commands/info.js';
import { labelsCommand } from './commands/labels.js';
import { moveCommand } from './commands/move.js';
import { openCommand } from './commands/open.js';
import { folderCommand } from './commands/folder.js';
import { pullCommand } from './commands/pull.js';
import { searchCommand } from './commands/search.js';
import { setup } from './commands/setup.js';
import { spacesCommand } from './commands/spaces.js';
import { statusCommand } from './commands/status.js';
import { treeCommand } from './commands/tree.js';
import { updateCommand } from './commands/update.js';

import { findPositional } from './utils/args.js';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

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

      case 'clone': {
        if (args.includes('--help')) {
          showCloneHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }

        // Get space keys (all non-flag arguments after 'clone')
        const spaceKeys = subArgs.filter((arg) => !arg.startsWith('--'));
        if (spaceKeys.length === 0) {
          console.error(chalk.red('At least one space key is required.'));
          console.log(chalk.gray('Usage: cn clone <SPACE_KEY> [SPACE_KEY...]'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }

        await cloneCommand({ spaceKeys });
        break;
      }

      case 'pull': {
        if (args.includes('--help')) {
          showPullHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }

        const dryRun = args.includes('--dry-run');
        const force = args.includes('--force');

        let depth: number | undefined;
        const depthIndex = args.indexOf('--depth');
        if (depthIndex !== -1 && depthIndex + 1 < args.length) {
          depth = Number.parseInt(args[depthIndex + 1], 10);
        }

        // Collect all --page arguments (can appear multiple times)
        const pages: string[] = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '--page' && i + 1 < args.length) {
            pages.push(args[i + 1]);
          }
        }

        await pullCommand({ dryRun, force, depth, pages: pages.length > 0 ? pages : undefined });
        break;
      }

      case 'folder': {
        if (args.includes('--help') && !subArgs.find((a) => !a.startsWith('--'))) {
          showFolderHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        const folderSubcommand = subArgs[0];
        if (!folderSubcommand || folderSubcommand.startsWith('--')) {
          showFolderHelp();
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        const folderSubArgs = subArgs.slice(1);
        await folderCommand(folderSubcommand, folderSubArgs, args);
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

      case 'doctor':
        if (args.includes('--help')) {
          showDoctorHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        await doctorCommand({
          fix: args.includes('--fix'),
          xml: args.includes('--xml'),
        });
        break;

      case 'spaces':
        if (args.includes('--help')) {
          showSpacesHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        {
          let limit: number | undefined;
          const limitArg = args.find((a) => a.startsWith('--limit=') || a === '--limit');
          if (limitArg) {
            limit = limitArg.includes('=')
              ? Number.parseInt(limitArg.split('=')[1], 10)
              : Number.parseInt(args[args.indexOf('--limit') + 1], 10);
          }
          let page: number | undefined;
          const pageArg = args.find((a) => a.startsWith('--page=') || a === '--page');
          if (pageArg) {
            page = pageArg.includes('=')
              ? Number.parseInt(pageArg.split('=')[1], 10)
              : Number.parseInt(args[args.indexOf('--page') + 1], 10);
          }
          await spacesCommand({ xml: args.includes('--xml'), limit, page });
        }
        break;

      case 'search': {
        if (args.includes('--help')) {
          showSearchHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        let spaceKey: string | undefined;
        const spaceIdx = args.indexOf('--space');
        if (spaceIdx !== -1 && spaceIdx + 1 < args.length) {
          spaceKey = args[spaceIdx + 1];
        }
        let limit: number | undefined;
        const limitIdx = args.indexOf('--limit');
        if (limitIdx !== -1 && limitIdx + 1 < args.length) {
          limit = Number.parseInt(args[limitIdx + 1], 10);
        }
        const searchFlagValues = new Set(
          [spaceKey, limit !== undefined ? args[limitIdx + 1] : undefined].filter(Boolean),
        );
        const query = subArgs.find((arg) => !arg.startsWith('--') && !searchFlagValues.has(arg));
        if (!query) {
          console.error(chalk.red('Search query is required.'));
          console.log(chalk.gray('Usage: cn search <query>'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        await searchCommand(query, { space: spaceKey, limit, xml: args.includes('--xml') });
        break;
      }

      case 'info': {
        if (args.includes('--help')) {
          showInfoHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        const target = subArgs.find((arg) => !arg.startsWith('--'));
        if (!target) {
          console.error(chalk.red('Page ID or file path is required.'));
          console.log(chalk.gray('Usage: cn info <id|file>'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        await infoCommand(target, { xml: args.includes('--xml') });
        break;
      }

      case 'create': {
        if (args.includes('--help')) {
          showCreateHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        let spaceKey: string | undefined;
        const spaceIdx = args.indexOf('--space');
        if (spaceIdx !== -1 && spaceIdx + 1 < args.length) {
          spaceKey = args[spaceIdx + 1];
        }
        let parentId: string | undefined;
        const parentIdx = args.indexOf('--parent');
        if (parentIdx !== -1 && parentIdx + 1 < args.length) {
          parentId = args[parentIdx + 1];
        }
        let createFormat: string | undefined;
        const createFormatIdx = args.indexOf('--format');
        if (createFormatIdx !== -1 && createFormatIdx + 1 < args.length) {
          createFormat = args[createFormatIdx + 1];
        }
        const title = findPositional(subArgs, ['--space', '--parent', '--format']);
        if (!title) {
          console.error(chalk.red('Page title is required.'));
          console.log(chalk.gray('Usage: cn create <title>'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        await createCommand(title, {
          space: spaceKey,
          parent: parentId,
          open: args.includes('--open'),
          format: createFormat,
        });
        break;
      }

      case 'delete': {
        if (args.includes('--help')) {
          showDeleteHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        const pageId = subArgs.find((arg) => !arg.startsWith('--'));
        if (!pageId) {
          console.error(chalk.red('Page ID is required.'));
          console.log(chalk.gray('Usage: cn delete <id>'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        await deleteCommand(pageId, { force: args.includes('--force') });
        break;
      }

      case 'comments': {
        if (args.includes('--help')) {
          showCommentsHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        const target = subArgs.find((arg) => !arg.startsWith('--'));
        if (!target) {
          console.error(chalk.red('Page ID or file path is required.'));
          console.log(chalk.gray('Usage: cn comments <id|file>'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        await commentsCommand(target, { xml: args.includes('--xml') });
        break;
      }

      case 'labels': {
        if (args.includes('--help')) {
          showLabelsHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        let addLabel: string | undefined;
        const addIdx = args.indexOf('--add');
        if (addIdx !== -1 && addIdx + 1 < args.length) {
          addLabel = args[addIdx + 1];
        }
        let removeLabel: string | undefined;
        const removeIdx = args.indexOf('--remove');
        if (removeIdx !== -1 && removeIdx + 1 < args.length) {
          removeLabel = args[removeIdx + 1];
        }
        const labelFlagValues = new Set([addLabel, removeLabel].filter(Boolean));
        const labelsTarget = subArgs.find((arg) => !arg.startsWith('--') && !labelFlagValues.has(arg));
        if (!labelsTarget) {
          console.error(chalk.red('Page ID or file path is required.'));
          console.log(chalk.gray('Usage: cn labels <id|file>'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        await labelsCommand(labelsTarget, { add: addLabel, remove: removeLabel, xml: args.includes('--xml') });
        break;
      }

      case 'move': {
        if (args.includes('--help')) {
          showMoveHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        const nonFlags = subArgs.filter((arg) => !arg.startsWith('--'));
        if (nonFlags.length < 2) {
          console.error(chalk.red('Page target and parent ID are required.'));
          console.log(chalk.gray('Usage: cn move <id|file> <parentId>'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        await moveCommand(nonFlags[0], nonFlags[1]);
        break;
      }

      case 'attachments': {
        if (args.includes('--help')) {
          showAttachmentsHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        let uploadFile: string | undefined;
        const uploadIdx = args.indexOf('--upload');
        if (uploadIdx !== -1 && uploadIdx + 1 < args.length) {
          uploadFile = args[uploadIdx + 1];
        }
        let downloadId: string | undefined;
        const downloadIdx = args.indexOf('--download');
        if (downloadIdx !== -1 && downloadIdx + 1 < args.length) {
          downloadId = args[downloadIdx + 1];
        }
        let deleteId: string | undefined;
        const deleteIdx = args.indexOf('--delete');
        if (deleteIdx !== -1 && deleteIdx + 1 < args.length) {
          deleteId = args[deleteIdx + 1];
        }
        const attachFlagValues = new Set([uploadFile, downloadId, deleteId].filter(Boolean));
        const attachTarget = subArgs.find((arg) => !arg.startsWith('--') && !attachFlagValues.has(arg));
        if (!attachTarget) {
          console.error(chalk.red('Page ID or file path is required.'));
          console.log(chalk.gray('Usage: cn attachments <id|file>'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        await attachmentsCommand(attachTarget, {
          upload: uploadFile,
          download: downloadId,
          delete: deleteId,
          xml: args.includes('--xml'),
        });
        break;
      }

      case 'update': {
        if (args.includes('--help')) {
          showUpdateHelp();
          process.exit(EXIT_CODES.SUCCESS);
        }
        let updateFormat: string | undefined;
        const updateFormatIdx = args.indexOf('--format');
        if (updateFormatIdx !== -1 && updateFormatIdx + 1 < args.length) {
          updateFormat = args[updateFormatIdx + 1];
        }
        let updateTitle: string | undefined;
        const updateTitleIdx = args.indexOf('--title');
        if (updateTitleIdx !== -1 && updateTitleIdx + 1 < args.length) {
          updateTitle = args[updateTitleIdx + 1];
        }
        let updateMessage: string | undefined;
        const updateMessageIdx = args.indexOf('--message');
        if (updateMessageIdx !== -1 && updateMessageIdx + 1 < args.length) {
          updateMessage = args[updateMessageIdx + 1];
        }
        const updateId = findPositional(subArgs, ['--format', '--title', '--message']);
        if (!updateId) {
          console.error(chalk.red('Page ID is required.'));
          console.log(chalk.gray('Usage: cn update <id>'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        await updateCommand(updateId, {
          format: updateFormat,
          title: updateTitle,
          message: updateMessage,
        });
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
