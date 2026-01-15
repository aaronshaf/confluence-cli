import chalk from 'chalk';
import type { Page, Space } from './confluence-client/types.js';
import type { SyncDiff } from './sync/sync-engine.js';

/**
 * Base formatter interface
 */
export interface Formatter {
  formatSpaces(spaces: Space[]): string;
  formatPages(pages: Page[], spaceKey: string): string;
  formatSyncDiff(diff: SyncDiff): string;
  formatStatus(status: StatusInfo): string;
  formatTree(nodes: TreeNode[], depth?: number): string;
}

export interface StatusInfo {
  connected: boolean;
  configured: boolean;
  initialized: boolean;
  confluenceUrl?: string;
  email?: string;
  spaceKey?: string;
  spaceName?: string;
  lastSync?: string;
  pageCount?: number;
  pendingChanges?: {
    added: number;
    modified: number;
    deleted: number;
  };
}

export interface TreeNode {
  id: string;
  title: string;
  children: TreeNode[];
  depth?: number;
}

/**
 * XML escape helper
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Human-readable formatter with colors
 */
export class HumanFormatter implements Formatter {
  formatSpaces(spaces: Space[]): string {
    if (spaces.length === 0) {
      return chalk.yellow('No spaces found.');
    }

    const lines = [chalk.bold('Spaces:'), ''];
    for (const space of spaces) {
      lines.push(`  ${chalk.cyan(space.key)} - ${space.name}`);
      if (space.description?.plain?.value) {
        lines.push(chalk.gray(`    ${space.description.plain.value.substring(0, 80)}...`));
      }
    }
    return lines.join('\n');
  }

  formatPages(pages: Page[], spaceKey: string): string {
    if (pages.length === 0) {
      return chalk.yellow(`No pages found in space ${spaceKey}.`);
    }

    const lines = [chalk.bold(`Pages in ${spaceKey}:`), ''];
    for (const page of pages) {
      lines.push(`  ${chalk.cyan(page.id)} - ${page.title}`);
    }
    lines.push('', chalk.gray(`Total: ${pages.length} pages`));
    return lines.join('\n');
  }

  formatSyncDiff(diff: SyncDiff): string {
    const lines: string[] = [];

    if (diff.added.length > 0) {
      lines.push(chalk.green.bold('Added:'));
      for (const change of diff.added) {
        lines.push(chalk.green(`  + ${change.title}`));
      }
      lines.push('');
    }

    if (diff.modified.length > 0) {
      lines.push(chalk.yellow.bold('Modified:'));
      for (const change of diff.modified) {
        lines.push(chalk.yellow(`  ~ ${change.title}`));
      }
      lines.push('');
    }

    if (diff.deleted.length > 0) {
      lines.push(chalk.red.bold('Deleted:'));
      for (const change of diff.deleted) {
        lines.push(chalk.red(`  - ${change.title}`));
      }
      lines.push('');
    }

    if (diff.added.length === 0 && diff.modified.length === 0 && diff.deleted.length === 0) {
      lines.push(chalk.gray('No changes detected.'));
    } else {
      lines.push(
        chalk.gray(
          `Summary: ${diff.added.length} added, ${diff.modified.length} modified, ${diff.deleted.length} deleted`,
        ),
      );
    }

    return lines.join('\n');
  }

  formatStatus(status: StatusInfo): string {
    const lines: string[] = [];

    if (!status.configured) {
      lines.push(chalk.red('Not configured.'));
      lines.push(chalk.gray('Run "cn setup" to configure Confluence credentials.'));
      return lines.join('\n');
    }

    lines.push(chalk.bold('Configuration:'));
    lines.push(`  URL: ${chalk.cyan(status.confluenceUrl || 'N/A')}`);
    lines.push(`  Email: ${chalk.cyan(status.email || 'N/A')}`);
    lines.push('');

    if (status.connected) {
      lines.push(chalk.green('✓ Connected to Confluence'));
    } else {
      lines.push(chalk.red('✗ Not connected'));
    }
    lines.push('');

    if (!status.initialized) {
      lines.push(chalk.yellow('No space initialized in current directory.'));
      lines.push(chalk.gray('Run "cn sync --init <SPACE_KEY>" to initialize.'));
    } else {
      lines.push(chalk.bold('Space:'));
      lines.push(`  Key: ${chalk.cyan(status.spaceKey || 'N/A')}`);
      lines.push(`  Name: ${status.spaceName || 'N/A'}`);
      lines.push(`  Last Sync: ${status.lastSync || 'Never'}`);
      lines.push(`  Pages: ${status.pageCount || 0}`);

      if (status.pendingChanges) {
        const { added, modified, deleted } = status.pendingChanges;
        if (added > 0 || modified > 0 || deleted > 0) {
          lines.push('');
          lines.push(chalk.bold('Pending Changes:'));
          if (added > 0) lines.push(chalk.green(`  + ${added} new`));
          if (modified > 0) lines.push(chalk.yellow(`  ~ ${modified} modified`));
          if (deleted > 0) lines.push(chalk.red(`  - ${deleted} deleted`));
        }
      }
    }

    return lines.join('\n');
  }

  formatTree(nodes: TreeNode[], depth = 0): string {
    const lines: string[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isLast = i === nodes.length - 1;
      const prefix = depth === 0 ? '' : '  '.repeat(depth - 1) + (isLast ? '└── ' : '├── ');

      lines.push(`${prefix}${node.title}`);

      if (node.children.length > 0) {
        lines.push(this.formatTree(node.children, depth + 1));
      }
    }

    return lines.join('\n');
  }
}

/**
 * XML formatter for LLM consumption per ADR-0011
 */
export class XmlFormatter implements Formatter {
  formatSpaces(spaces: Space[]): string {
    const lines = ['<spaces>'];
    for (const space of spaces) {
      lines.push(`  <space key="${escapeXml(space.key)}" id="${escapeXml(space.id)}">`);
      lines.push(`    <name>${escapeXml(space.name)}</name>`);
      if (space.description?.plain?.value) {
        lines.push(`    <description>${escapeXml(space.description.plain.value)}</description>`);
      }
      lines.push('  </space>');
    }
    lines.push('</spaces>');
    return lines.join('\n');
  }

  formatPages(pages: Page[], spaceKey: string): string {
    const lines = [`<pages space="${escapeXml(spaceKey)}" count="${pages.length}">`];
    for (const page of pages) {
      lines.push(`  <page id="${escapeXml(page.id)}">`);
      lines.push(`    <title>${escapeXml(page.title)}</title>`);
      if (page.parentId) {
        lines.push(`    <parent-id>${escapeXml(page.parentId)}</parent-id>`);
      }
      lines.push('  </page>');
    }
    lines.push('</pages>');
    return lines.join('\n');
  }

  formatSyncDiff(diff: SyncDiff): string {
    const lines = [
      `<sync-diff added="${diff.added.length}" modified="${diff.modified.length}" deleted="${diff.deleted.length}">`,
    ];

    if (diff.added.length > 0) {
      lines.push('  <added>');
      for (const change of diff.added) {
        lines.push(`    <page id="${escapeXml(change.pageId)}" title="${escapeXml(change.title)}" />`);
      }
      lines.push('  </added>');
    }

    if (diff.modified.length > 0) {
      lines.push('  <modified>');
      for (const change of diff.modified) {
        lines.push(`    <page id="${escapeXml(change.pageId)}" title="${escapeXml(change.title)}" />`);
      }
      lines.push('  </modified>');
    }

    if (diff.deleted.length > 0) {
      lines.push('  <deleted>');
      for (const change of diff.deleted) {
        lines.push(`    <page id="${escapeXml(change.pageId)}" title="${escapeXml(change.title)}" />`);
      }
      lines.push('  </deleted>');
    }

    lines.push('</sync-diff>');
    return lines.join('\n');
  }

  formatStatus(status: StatusInfo): string {
    const lines = [
      `<status configured="${status.configured}" connected="${status.connected}" initialized="${status.initialized}">`,
    ];

    if (status.configured) {
      lines.push('  <configuration>');
      if (status.confluenceUrl) lines.push(`    <url>${escapeXml(status.confluenceUrl)}</url>`);
      if (status.email) lines.push(`    <email>${escapeXml(status.email)}</email>`);
      lines.push('  </configuration>');
    }

    if (status.initialized) {
      lines.push('  <space>');
      if (status.spaceKey) lines.push(`    <key>${escapeXml(status.spaceKey)}</key>`);
      if (status.spaceName) lines.push(`    <name>${escapeXml(status.spaceName)}</name>`);
      if (status.lastSync) lines.push(`    <last-sync>${escapeXml(status.lastSync)}</last-sync>`);
      if (status.pageCount !== undefined) lines.push(`    <page-count>${status.pageCount}</page-count>`);
      lines.push('  </space>');

      if (status.pendingChanges) {
        const { added, modified, deleted } = status.pendingChanges;
        lines.push(`  <pending-changes added="${added}" modified="${modified}" deleted="${deleted}" />`);
      }
    }

    lines.push('</status>');
    return lines.join('\n');
  }

  formatTree(nodes: TreeNode[], depth = 0): string {
    if (depth === 0) {
      const lines = ['<tree>'];
      lines.push(this.formatTreeNodes(nodes));
      lines.push('</tree>');
      return lines.join('\n');
    }
    return this.formatTreeNodes(nodes);
  }

  private formatTreeNodes(nodes: TreeNode[]): string {
    const lines: string[] = [];
    for (const node of nodes) {
      if (node.children.length > 0) {
        lines.push(`  <page id="${escapeXml(node.id)}" title="${escapeXml(node.title)}">`);
        lines.push(this.formatTreeNodes(node.children));
        lines.push('  </page>');
      } else {
        lines.push(`  <page id="${escapeXml(node.id)}" title="${escapeXml(node.title)}" />`);
      }
    }
    return lines.join('\n');
  }
}

/**
 * Get the appropriate formatter based on output mode
 */
export function getFormatter(xml: boolean): Formatter {
  return xml ? new XmlFormatter() : new HumanFormatter();
}
