import chalk from 'chalk';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { escapeXml } from '../../lib/formatters.js';
import { resolvePageTarget } from '../../lib/resolve-page-target.js';

export interface CommentsCommandOptions {
  xml?: boolean;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

export async function commentsCommand(target: string, options: CommentsCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const pageId = resolvePageTarget(target);
  const client = new ConfluenceClient(config);
  const comments = await client.getAllFooterComments(pageId);

  if (options.xml) {
    console.log('<comments>');
    for (const comment of comments) {
      const body = comment.body?.storage?.value ? stripHtml(comment.body.storage.value) : '';
      console.log(`  <comment id="${escapeXml(comment.id)}">`);
      if (body) console.log(`    <body>${escapeXml(body)}</body>`);
      if (comment.authorId) console.log(`    <authorId>${escapeXml(comment.authorId)}</authorId>`);
      if (comment.createdAt) console.log(`    <createdAt>${escapeXml(comment.createdAt)}</createdAt>`);
      console.log('  </comment>');
    }
    console.log('</comments>');
    return;
  }

  if (comments.length === 0) {
    console.log('No comments found.');
    return;
  }

  for (const comment of comments) {
    const body = comment.body?.storage?.value ? stripHtml(comment.body.storage.value) : '';
    console.log(chalk.gray(`--- ${comment.id} ---`));
    if (body) console.log(body);
    if (comment.authorId) console.log(chalk.gray(`Author: ${comment.authorId}`));
    if (comment.createdAt) console.log(chalk.gray(`Date: ${comment.createdAt}`));
    console.log();
  }
}
