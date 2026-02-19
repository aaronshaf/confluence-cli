import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { VALID_FORMATS, isValidFormat, readStdin } from '../utils/stdin.js';

export interface UpdateCommandOptions {
  format?: string;
  title?: string;
  message?: string;
}

export async function updateCommand(pageId: string, options: UpdateCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  if (process.stdin.isTTY) {
    console.error(chalk.red('No content provided. Pipe content via stdin.'));
    console.log(chalk.gray('Usage: echo "<p>Content</p>" | cn update <id>'));
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }

  const rawFormat = options.format ?? 'storage';
  if (!isValidFormat(rawFormat)) {
    console.error(chalk.red(`Invalid format: ${rawFormat}`));
    console.log(chalk.gray(`Valid formats: ${VALID_FORMATS.join(', ')}`));
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }
  const representation = rawFormat;

  const bodyValue = await readStdin();
  if (bodyValue.trim().length === 0) {
    console.error(chalk.red('Stdin is empty. Provide content to update the page.'));
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }

  const client = new ConfluenceClient(config);
  const current = await client.getPage(pageId, false);

  if (!current) {
    console.error(chalk.red(`Page not found: ${pageId}`));
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }

  const currentVersion = current.version?.number ?? 1;
  const title = options.title ?? current.title;

  const updated = await client.updatePage({
    id: pageId,
    status: 'current',
    title,
    body: {
      representation,
      value: bodyValue,
    },
    version: {
      number: currentVersion + 1,
      message: options.message,
    },
  });

  console.log(`${chalk.green('Updated:')} ${chalk.bold(updated.title)}  ${chalk.gray(updated.id)}`);
  if (updated._links?.webui) {
    const url = `${config.confluenceUrl}/wiki${updated._links.webui}`;
    console.log(`URL: ${chalk.blue(url)}`);
  }
}
