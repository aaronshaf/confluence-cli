import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { escapeXml } from '../../lib/formatters.js';

export interface SpacesCommandOptions {
  xml?: boolean;
  limit?: number;
  page?: number;
}

export async function spacesCommand(options: SpacesCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const limit = options.limit ?? 25;
  const page = options.page ?? 1;
  const client = new ConfluenceClient(config);
  const response = await client.getSpaces(limit, page);
  const spaces = response.results;

  if (options.xml) {
    console.log('<spaces>');
    for (const space of spaces) {
      console.log(
        `  <space id="${escapeXml(space.id)}" key="${escapeXml(space.key)}">${escapeXml(space.name)}</space>`,
      );
    }
    console.log('</spaces>');
    return;
  }

  if (spaces.length === 0) {
    console.log('No spaces found.');
    return;
  }

  for (const space of spaces) {
    console.log(`${chalk.bold(space.key)}  ${space.name}  ${chalk.gray(space.id)}`);
  }

  if (response.size === limit) {
    console.log(chalk.gray(`\nPage ${page}. Use --page ${page + 1} for next page, --limit to change page size.`));
  }
}
