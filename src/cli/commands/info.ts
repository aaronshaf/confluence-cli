import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { escapeXml } from '../../lib/formatters.js';
import { resolvePageTarget } from '../../lib/resolve-page-target.js';

export interface InfoCommandOptions {
  xml?: boolean;
}

export async function infoCommand(target: string, options: InfoCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const pageId = resolvePageTarget(target);
  const client = new ConfluenceClient(config);

  const [page, labels] = await Promise.all([client.getPage(pageId, false), client.getAllLabels(pageId)]);

  if (options.xml) {
    console.log('<page>');
    console.log(`  <id>${escapeXml(page.id)}</id>`);
    console.log(`  <title>${escapeXml(page.title)}</title>`);
    console.log(`  <spaceId>${escapeXml(page.spaceId)}</spaceId>`);
    if (page.status) console.log(`  <status>${escapeXml(page.status)}</status>`);
    if (page.parentId) console.log(`  <parentId>${escapeXml(page.parentId)}</parentId>`);
    if (page.version) console.log(`  <version>${page.version.number}</version>`);
    if (page._links?.webui)
      console.log(`  <url>${escapeXml(`${config.confluenceUrl}/wiki${page._links.webui}`)}</url>`);
    if (labels.length > 0) {
      console.log('  <labels>');
      for (const label of labels) {
        console.log(`    <label>${escapeXml(label.name)}</label>`);
      }
      console.log('  </labels>');
    }
    console.log('</page>');
    return;
  }

  console.log(`${chalk.bold(page.title)}  ${chalk.gray(page.id)}`);
  console.log(`Space: ${page.spaceId}`);
  if (page.status) console.log(`Status: ${page.status}`);
  if (page.parentId) console.log(`Parent: ${page.parentId}`);
  if (page.version) console.log(`Version: ${page.version.number}`);
  if (page._links?.webui) console.log(`URL: ${config.confluenceUrl}/wiki${page._links.webui}`);
  if (labels.length > 0) {
    console.log(`Labels: ${labels.map((l) => chalk.cyan(l.name)).join(', ')}`);
  }
}
