import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { ConfluenceClient } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { escapeXml } from '../../lib/formatters.js';
import { resolvePageTarget } from '../../lib/resolve-page-target.js';

export interface AttachmentsCommandOptions {
  upload?: string;
  download?: string;
  delete?: string;
  xml?: boolean;
}

export async function attachmentsCommand(target: string, options: AttachmentsCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();

  if (!config) {
    console.error(chalk.red('Not configured. Run: cn setup'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const pageId = resolvePageTarget(target);
  const client = new ConfluenceClient(config);

  if (options.upload) {
    const filePath = options.upload;
    const filename = basename(filePath);
    const data = readFileSync(filePath);
    const mimeType = guessMimeType(filename);
    await client.uploadAttachment(pageId, filename, data, mimeType);
    console.log(`${chalk.green('Uploaded:')} ${filename}`);
    return;
  }

  if (options.delete) {
    await client.deleteAttachment(options.delete);
    console.log(`${chalk.green('Deleted attachment:')} ${options.delete}`);
    return;
  }

  const attachments = await client.getAllAttachments(pageId);

  if (options.download) {
    const attachment = attachments.find((a) => a.id === options.download);
    if (!attachment) {
      console.error(chalk.red(`Attachment not found: ${options.download}`));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
    if (!attachment.downloadLink) {
      console.error(chalk.red('No download link available for this attachment.'));
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
    const buf = await client.downloadAttachment(attachment.downloadLink);
    const safeFilename = basename(attachment.title);
    writeFileSync(safeFilename, buf);
    console.log(`${chalk.green('Downloaded:')} ${safeFilename}`);
    return;
  }

  if (options.xml) {
    console.log('<attachments>');
    for (const att of attachments) {
      console.log(`  <attachment id="${escapeXml(att.id)}">`);
      console.log(`    <title>${escapeXml(att.title)}</title>`);
      if (att.mediaType) console.log(`    <mediaType>${escapeXml(att.mediaType)}</mediaType>`);
      if (att.fileSize != null) console.log(`    <fileSize>${att.fileSize}</fileSize>`);
      console.log('  </attachment>');
    }
    console.log('</attachments>');
    return;
  }

  if (attachments.length === 0) {
    console.log('No attachments.');
    return;
  }

  for (const att of attachments) {
    const size = att.fileSize != null ? ` (${formatBytes(att.fileSize)})` : '';
    const mime = att.mediaType ? ` [${att.mediaType}]` : '';
    console.log(`${chalk.bold(att.title)}  ${chalk.gray(att.id)}${mime}${size}`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
    csv: 'text/csv',
  };
  return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
}
