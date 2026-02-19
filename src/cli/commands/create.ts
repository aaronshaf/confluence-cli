import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { readSpaceConfig } from '../../lib/space-config.js';
import { openUrl } from '../utils/browser.js';
import { VALID_FORMATS, isValidFormat, readStdin } from '../utils/stdin.js';

export interface CreateCommandOptions {
  space?: string;
  parent?: string;
  open?: boolean;
  format?: string;
}

export async function createCommand(title: string, options: CreateCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const rawFormat = options.format ?? 'storage';
  if (!isValidFormat(rawFormat)) {
    console.error(chalk.red(`Invalid format: ${rawFormat}`));
    console.log(chalk.gray(`Valid formats: ${VALID_FORMATS.join(', ')}`));
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }
  const representation = rawFormat;

  let bodyValue = '';
  if (!process.stdin.isTTY) {
    bodyValue = await readStdin();
    if (bodyValue.trim().length === 0) {
      console.error(chalk.red('Stdin is empty. Provide content to create a page with body.'));
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }
  }

  const client = new ConfluenceClient(config);
  let spaceId: string | undefined;

  if (options.space) {
    const space = await client.getSpaceByKey(options.space);
    spaceId = space.id;
  } else {
    const spaceConfig = readSpaceConfig(process.cwd());
    if (!spaceConfig) {
      console.error(chalk.red('Not in a cloned space directory. Use --space to specify a space key.'));
      process.exit(EXIT_CODES.INVALID_ARGUMENTS);
    }
    spaceId = spaceConfig.spaceId;
  }

  const page = await client.createPage({
    spaceId,
    status: 'current',
    title,
    parentId: options.parent,
    body: {
      representation,
      value: bodyValue,
    },
  });

  console.log(`${chalk.green('Created:')} ${chalk.bold(page.title)}  ${chalk.gray(page.id)}`);
  if (page._links?.webui) {
    const url = `${config.confluenceUrl}/wiki${page._links.webui}`;
    console.log(`URL: ${chalk.blue(url)}`);

    if (options.open) {
      openUrl(url);
    }
  }
}
