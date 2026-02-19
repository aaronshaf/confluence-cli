import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { resolvePageTarget } from '../../lib/resolve-page-target.js';

export async function moveCommand(target: string, parentId: string): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const pageId = resolvePageTarget(target);
  const client = new ConfluenceClient(config);

  const [page, parent] = await Promise.all([client.getPage(pageId, false), client.getPage(parentId, false)]);

  await client.movePage(pageId, parentId);
  console.log(`${chalk.green('Moved:')} "${page.title}" under "${parent.title}"`);
}
