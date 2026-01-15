import { describe, expect, test } from 'bun:test';
import { HumanFormatter, XmlFormatter, getFormatter, type StatusInfo, type TreeNode } from '../lib/formatters.js';
import type { SyncDiff } from '../lib/sync/sync-engine.js';

describe('HumanFormatter', () => {
  const formatter = new HumanFormatter();

  describe('formatSpaces', () => {
    test('formats list of spaces', () => {
      const spaces = [
        { id: '1', key: 'TEST', name: 'Test Space' },
        { id: '2', key: 'DOCS', name: 'Documentation' },
      ];

      const output = formatter.formatSpaces(spaces);

      expect(output).toContain('TEST');
      expect(output).toContain('Test Space');
      expect(output).toContain('DOCS');
      expect(output).toContain('Documentation');
    });

    test('handles empty spaces list', () => {
      const output = formatter.formatSpaces([]);
      expect(output).toContain('No spaces found');
    });
  });

  describe('formatSyncDiff', () => {
    test('formats diff with changes', () => {
      const diff: SyncDiff = {
        added: [{ type: 'added', pageId: '1', title: 'New Page' }],
        modified: [{ type: 'modified', pageId: '2', title: 'Updated Page' }],
        deleted: [{ type: 'deleted', pageId: '3', title: 'Removed Page' }],
      };

      const output = formatter.formatSyncDiff(diff);

      expect(output).toContain('Added');
      expect(output).toContain('New Page');
      expect(output).toContain('Modified');
      expect(output).toContain('Updated Page');
      expect(output).toContain('Deleted');
      expect(output).toContain('Removed Page');
    });

    test('handles no changes', () => {
      const diff: SyncDiff = {
        added: [],
        modified: [],
        deleted: [],
      };

      const output = formatter.formatSyncDiff(diff);
      expect(output).toContain('No changes');
    });
  });

  describe('formatStatus', () => {
    test('formats unconfigured status', () => {
      const status: StatusInfo = {
        configured: false,
        connected: false,
        initialized: false,
      };

      const output = formatter.formatStatus(status);
      expect(output).toContain('Not configured');
    });

    test('formats configured status', () => {
      const status: StatusInfo = {
        configured: true,
        connected: true,
        initialized: true,
        confluenceUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        spaceKey: 'TEST',
        spaceName: 'Test Space',
        lastSync: '2024-01-01T00:00:00Z',
        pageCount: 10,
      };

      const output = formatter.formatStatus(status);

      expect(output).toContain('https://test.atlassian.net');
      expect(output).toContain('test@example.com');
      expect(output).toContain('TEST');
      expect(output).toContain('Test Space');
    });
  });

  describe('formatTree', () => {
    test('formats page tree', () => {
      const nodes: TreeNode[] = [
        {
          id: '1',
          title: 'Home',
          children: [
            { id: '2', title: 'Getting Started', children: [] },
            { id: '3', title: 'API Reference', children: [] },
          ],
        },
      ];

      const output = formatter.formatTree(nodes);

      expect(output).toContain('Home');
      expect(output).toContain('Getting Started');
      expect(output).toContain('API Reference');
    });

    test('formats empty tree', () => {
      const output = formatter.formatTree([]);
      expect(output).toBe('');
    });
  });
});

describe('XmlFormatter', () => {
  const formatter = new XmlFormatter();

  describe('formatSpaces', () => {
    test('formats spaces as XML', () => {
      const spaces = [{ id: '1', key: 'TEST', name: 'Test Space' }];

      const output = formatter.formatSpaces(spaces);

      expect(output).toContain('<spaces>');
      expect(output).toContain('</spaces>');
      expect(output).toContain('key="TEST"');
      expect(output).toContain('<name>Test Space</name>');
    });

    test('escapes special characters', () => {
      const spaces = [{ id: '1', key: 'TEST', name: 'Test & <Space>' }];

      const output = formatter.formatSpaces(spaces);

      expect(output).toContain('&amp;');
      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
    });
  });

  describe('formatSyncDiff', () => {
    test('formats diff as XML', () => {
      const diff: SyncDiff = {
        added: [{ type: 'added', pageId: '1', title: 'New Page' }],
        modified: [],
        deleted: [],
      };

      const output = formatter.formatSyncDiff(diff);

      expect(output).toContain('<sync-diff');
      expect(output).toContain('added="1"');
      expect(output).toContain('<added>');
      expect(output).toContain('id="1"');
      expect(output).toContain('title="New Page"');
    });
  });

  describe('formatStatus', () => {
    test('formats status as XML', () => {
      const status: StatusInfo = {
        configured: true,
        connected: true,
        initialized: true,
        confluenceUrl: 'https://test.atlassian.net',
        spaceKey: 'TEST',
      };

      const output = formatter.formatStatus(status);

      expect(output).toContain('<status');
      expect(output).toContain('configured="true"');
      expect(output).toContain('connected="true"');
      expect(output).toContain('<url>https://test.atlassian.net</url>');
    });
  });

  describe('formatTree', () => {
    test('formats tree as XML', () => {
      const nodes: TreeNode[] = [
        {
          id: '1',
          title: 'Home',
          children: [{ id: '2', title: 'Child', children: [] }],
        },
      ];

      const output = formatter.formatTree(nodes);

      expect(output).toContain('<tree>');
      expect(output).toContain('</tree>');
      expect(output).toContain('id="1"');
      expect(output).toContain('title="Home"');
    });
  });
});

describe('getFormatter', () => {
  test('returns HumanFormatter for non-XML mode', () => {
    const formatter = getFormatter(false);
    expect(formatter).toBeInstanceOf(HumanFormatter);
  });

  test('returns XmlFormatter for XML mode', () => {
    const formatter = getFormatter(true);
    expect(formatter).toBeInstanceOf(XmlFormatter);
  });
});
