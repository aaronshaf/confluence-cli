import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { escapeXml } from '../../lib/formatters.js';
import { resolvePageTarget } from '../../lib/resolve-page-target.js';

export interface LabelsCommandOptions {
  add?: string;
  remove?: string;
  xml?: boolean;
}

export async function labelsCommand(target: string, options: LabelsCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const pageId = resolvePageTarget(target);
  const client = new ConfluenceClient(config);

  if (options.add) {
    await client.addLabel(pageId, options.add);
    console.log(`${chalk.green('Added label:')} ${options.add}`);
  }

  if (options.remove) {
    await client.removeLabel(pageId, options.remove);
    console.log(`${chalk.green('Removed label:')} ${options.remove}`);
  }

  const labels = await client.getAllLabels(pageId);

  if (options.xml) {
    console.log('<labels>');
    for (const label of labels) {
      console.log(`  <label>${escapeXml(label.name)}</label>`);
    }
    console.log('</labels>');
    return;
  }

  if (labels.length === 0) {
    console.log('No labels.');
    return;
  }

  console.log(labels.map((l) => chalk.cyan(l.name)).join(', '));
}
