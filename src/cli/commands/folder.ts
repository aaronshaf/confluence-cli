import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { escapeXml } from '../../lib/formatters.js';
import { readSpaceConfig } from '../../lib/space-config.js';

/**
 * Extract a flag value from an args array, e.g. --space DOCS -> "DOCS"
 */
function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  return undefined;
}

/**
 * Get positional args by stripping flags and their values
 */
function getPositionals(args: string[], flagsWithValues: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      if (flagsWithValues.includes(args[i])) {
        i++; // skip the value too
      }
    } else {
      result.push(args[i]);
    }
  }
  return result;
}

export async function folderCommand(subcommand: string, subArgs: string[], allArgs: string[]): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const client = new ConfluenceClient(config);

  switch (subcommand) {
    case 'create': {
      const positionals = getPositionals(subArgs, ['--space', '--parent']);
      const title = positionals[0];
      if (!title) {
        console.error(chalk.red('Folder title is required.'));
        console.log(chalk.gray('Usage: cn folder create <title> --space <key>'));
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }

      const spaceKeyArg = getFlagValue(allArgs, '--space');
      const parentId = getFlagValue(allArgs, '--parent');

      let spaceId: string;

      if (spaceKeyArg) {
        const space = await client.getSpaceByKey(spaceKeyArg);
        spaceId = space.id;
      } else {
        const spaceConfig = readSpaceConfig(process.cwd());
        if (!spaceConfig) {
          console.error(chalk.red('Not in a cloned space directory. Use --space to specify a space key.'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        spaceId = spaceConfig.spaceId;
      }

      const folder = await client.createFolder({ spaceId, title, parentId });
      console.log(`${chalk.green('Created:')} "${folder.title}" (${folder.id})`);
      break;
    }

    case 'list': {
      const spaceKeyArg = getFlagValue(allArgs, '--space');

      let spaceKey: string;

      if (spaceKeyArg) {
        spaceKey = spaceKeyArg;
      } else {
        const spaceConfig = readSpaceConfig(process.cwd());
        if (!spaceConfig) {
          console.error(chalk.red('Not in a cloned space directory. Use --space to specify a space key.'));
          process.exit(EXIT_CODES.INVALID_ARGUMENTS);
        }
        spaceKey = spaceConfig.spaceKey;
      }

      const cql = `type=folder AND space="${spaceKey.replace(/"/g, '\\"')}"`;
      const PAGE_SIZE = 100;
      const allResults: (typeof firstPage.results)[number][] = [];
      let start = 0;

      const firstPage = await client.search(cql, PAGE_SIZE, start);
      allResults.push(...firstPage.results);
      const total = firstPage.totalSize ?? firstPage.results.length;

      while (allResults.length < total) {
        start += PAGE_SIZE;
        const page = await client.search(cql, PAGE_SIZE, start);
        if (page.results.length === 0) break;
        allResults.push(...page.results);
      }

      const xml = allArgs.includes('--xml');

      if (xml) {
        console.log('<folders>');
        for (const result of allResults) {
          const c = result.content;
          if (c) {
            console.log(`  <folder>`);
            console.log(`    <id>${escapeXml(c.id ?? '')}</id>`);
            console.log(`    <title>${escapeXml(c.title ?? '')}</title>`);
            console.log(`  </folder>`);
          }
        }
        console.log('</folders>');
      } else {
        if (allResults.length === 0) {
          console.log(chalk.gray('No folders found.'));
        } else {
          for (const result of allResults) {
            const c = result.content;
            if (c) {
              console.log(`${chalk.cyan(c.id)}  ${c.title}`);
            }
          }
        }
      }
      break;
    }

    case 'delete': {
      const positionals = getPositionals(subArgs, []);
      const folderId = positionals[0];
      if (!folderId) {
        console.error(chalk.red('Folder ID is required.'));
        console.log(chalk.gray('Usage: cn folder delete <id>'));
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }

      if (!allArgs.includes('--force')) {
        const folder = await client.getFolder(folderId);
        const confirmed = await confirm({
          message: `Delete folder "${folder.title}" (${folderId})?`,
          default: false,
        });
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await client.deleteFolder(folderId);
      console.log(`${chalk.green('Deleted:')} ${folderId}`);
      break;
    }

    case 'move': {
      const positionals = getPositionals(subArgs, []);
      if (positionals.length < 2) {
        console.error(chalk.red('Folder ID and parent ID are required.'));
        console.log(chalk.gray('Usage: cn folder move <id> <parentId>'));
        process.exit(EXIT_CODES.INVALID_ARGUMENTS);
      }

      const folderId = positionals[0] as string;
      const parentId = positionals[1] as string;
      const [folder, parent] = await Promise.all([client.getFolder(folderId), client.getFolder(parentId)]);

      await client.movePage(folderId, parentId);
      console.log(`${chalk.green('Moved:')} "${folder.title}" under "${parent.title}"`);
      break;
    }

    default:
      console.error(chalk.red(`Unknown folder subcommand: ${subcommand}`));
      console.log(chalk.gray('Run "cn folder --help" for usage information.'));
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }
}
