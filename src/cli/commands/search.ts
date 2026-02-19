import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { escapeXml } from '../../lib/formatters.js';

export interface SearchCommandOptions {
  space?: string;
  limit?: number;
  xml?: boolean;
}

export async function searchCommand(query: string, options: SearchCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  let cql = `type=page AND text~"${query.replace(/"/g, '\\"')}"`;
  if (options.space) {
    cql += ` AND space="${options.space.replace(/"/g, '\\"')}"`;
  }

  const client = new ConfluenceClient(config);
  const response = await client.search(cql, options.limit ?? 10);

  if (options.xml) {
    console.log('<results>');
    for (const item of response.results) {
      const content = item.content;
      const webui = content?._links?.webui;
      const id = content?.id ?? item.id ?? '';
      const title = content?.title ?? item.title ?? '';
      console.log(`  <result id="${escapeXml(id)}">`);
      console.log(`    <title>${escapeXml(title)}</title>`);
      if (item.excerpt) console.log(`    <excerpt>${escapeXml(item.excerpt)}</excerpt>`);
      if (webui) console.log(`    <url>${escapeXml(`${config.confluenceUrl}/wiki${webui}`)}</url>`);
      console.log('  </result>');
    }
    console.log('</results>');
    return;
  }

  if (response.results.length === 0) {
    console.log('No results found.');
    return;
  }

  for (const item of response.results) {
    const content = item.content;
    const title = content?.title ?? item.title ?? '(untitled)';
    const id = content?.id ?? item.id ?? '';
    const webui = content?._links?.webui;
    const url = webui ? `${config.confluenceUrl}/wiki${webui}` : '';
    console.log(`${chalk.bold(title)}  ${chalk.gray(id)}`);
    if (item.excerpt) console.log(`  ${chalk.gray(item.excerpt)}`);
    if (url) console.log(`  ${chalk.blue(url)}`);
  }
}
