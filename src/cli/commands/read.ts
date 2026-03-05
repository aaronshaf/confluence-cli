import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { escapeXml } from '../../lib/formatters.js';
import { MarkdownConverter } from '../../lib/markdown/index.js';
import { resolvePageTarget } from '../../lib/resolve-page-target.js';

export interface ReadCommandOptions {
  xml?: boolean;
  html?: boolean;
}

export async function readCommand(target: string, options: ReadCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  if (options.xml && options.html) {
    console.error(chalk.red('Cannot use --xml and --html together.'));
    process.exit(EXIT_CODES.INVALID_ARGUMENTS);
  }

  const pageId = resolvePageTarget(target);
  const client = new ConfluenceClient(config);
  const page = await client.getPage(pageId, true);

  const storageHtml = page.body?.storage?.value || '';

  if (options.xml) {
    const converter = new MarkdownConverter();
    const markdown = converter.convert(storageHtml);
    console.log('<page>');
    console.log(`  <id>${escapeXml(page.id)}</id>`);
    console.log(`  <title>${escapeXml(page.title)}</title>`);
    console.log(`  <content>${escapeXml(markdown)}</content>`);
    console.log('</page>');
    return;
  }

  if (options.html) {
    console.log(storageHtml);
    return;
  }

  const converter = new MarkdownConverter();
  const markdown = converter.convert(storageHtml);
  console.log(markdown);
}
