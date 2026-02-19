import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { resolvePageTarget } from '../../lib/resolve-page-target.js';

export interface DeleteCommandOptions {
  force?: boolean;
}

export async function deleteCommand(target: string, options: DeleteCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const pageId = resolvePageTarget(target);
  const client = new ConfluenceClient(config);

  if (!options.force) {
    let page: Awaited<ReturnType<typeof client.getPage>>;
    try {
      page = await client.getPage(pageId, false);
    } catch {
      console.error(chalk.red(`Page not found: ${pageId}`));
      process.exit(EXIT_CODES.PAGE_NOT_FOUND);
    }

    const confirmed = await confirm({
      message: `Delete "${page.title}" (${pageId})?`,
      default: false,
    });

    if (!confirmed) {
      console.log('Cancelled.');
      return;
    }
  }

  await client.deletePage(pageId);
  console.log(`${chalk.green('Deleted:')} ${pageId}`);
}
