import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createSpaceConfig,
  readSpaceConfig,
  writeSpaceConfig,
  hasSpaceConfig,
  updateLastSync,
  updatePageSyncInfo,
  removePageSyncInfo,
  getTrackedPageIds,
  updateFolderSyncInfo,
  getFolderByPath,
  getFolderById,
  removeFolderSyncInfo,
  type SpaceConfigWithState,
  type FolderSyncInfo,
} from '../lib/space-config.js';

describe('space-config', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `cn-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('createSpaceConfig', () => {
    test('creates config with required fields', () => {
      const config = createSpaceConfig('TEST', 'space-123', 'Test Space');

      expect(config.spaceKey).toBe('TEST');
      expect(config.spaceId).toBe('space-123');
      expect(config.spaceName).toBe('Test Space');
      expect(config.pages).toEqual({});
      expect(config.lastSync).toBeUndefined();
    });
  });

  describe('hasSpaceConfig', () => {
    test('returns false when no config exists', () => {
      expect(hasSpaceConfig(testDir)).toBe(false);
    });

    test('returns true when config exists', () => {
      const configPath = join(testDir, '.confluence.json');
      writeFileSync(configPath, JSON.stringify({ spaceKey: 'TEST' }));

      expect(hasSpaceConfig(testDir)).toBe(true);
    });
  });

  describe('readSpaceConfig', () => {
    test('returns null when no config exists', () => {
      const config = readSpaceConfig(testDir);
      expect(config).toBeNull();
    });

    test('reads valid config', () => {
      // Per ADR-0024: pages is now Record<string, string> (pageId -> localPath)
      const testConfig: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        lastSync: '2024-01-01T00:00:00Z',
        pages: {
          'page-1': 'home.md',
        },
      };

      const configPath = join(testDir, '.confluence.json');
      writeFileSync(configPath, JSON.stringify(testConfig));

      const config = readSpaceConfig(testDir);

      expect(config).not.toBeNull();
      expect(config?.spaceKey).toBe('TEST');
      expect(config?.spaceName).toBe('Test Space');
      expect(config?.pages['page-1']).toBe('home.md');
    });

    test('migrates legacy format to new format', () => {
      // Legacy format: pages contain full PageSyncInfo objects
      const legacyConfig = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {
          'page-1': {
            pageId: 'page-1',
            version: 5,
            lastModified: '2024-01-14T08:00:00Z',
            localPath: 'docs/intro.md',
            title: 'Introduction',
          },
          'page-2': {
            pageId: 'page-2',
            version: 3,
            localPath: 'docs/setup.md',
            title: 'Setup Guide',
          },
        },
      };

      const configPath = join(testDir, '.confluence.json');
      writeFileSync(configPath, JSON.stringify(legacyConfig));

      const config = readSpaceConfig(testDir);

      // Should be migrated to new format
      expect(config).not.toBeNull();
      expect(config?.pages['page-1']).toBe('docs/intro.md');
      expect(config?.pages['page-2']).toBe('docs/setup.md');

      // Verify the file was rewritten with new format
      const savedContent = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(savedContent.pages['page-1']).toBe('docs/intro.md');
      expect(savedContent.pages['page-2']).toBe('docs/setup.md');
    });

    test('returns null for invalid JSON', () => {
      const configPath = join(testDir, '.confluence.json');
      writeFileSync(configPath, 'invalid json');

      const config = readSpaceConfig(testDir);
      expect(config).toBeNull();
    });
  });

  describe('writeSpaceConfig', () => {
    test('writes config to file', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      writeSpaceConfig(testDir, config);

      const configPath = join(testDir, '.confluence.json');
      expect(existsSync(configPath)).toBe(true);

      const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(saved.spaceKey).toBe('TEST');
    });
  });

  describe('updateLastSync', () => {
    test('adds lastSync timestamp', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const updated = updateLastSync(config);

      expect(updated.lastSync).toBeDefined();
      if (updated.lastSync) {
        expect(new Date(updated.lastSync).getTime()).toBeGreaterThan(0);
      }
    });

    test('does not mutate original config', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const updated = updateLastSync(config);

      expect(config.lastSync).toBeUndefined();
      expect(updated).not.toBe(config);
    });
  });

  describe('updatePageSyncInfo', () => {
    test('adds new page', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      // Per ADR-0024: Only pageId and localPath are stored
      const updated = updatePageSyncInfo(config, {
        pageId: 'page-1',
        localPath: 'home.md',
      });

      expect(updated.pages['page-1']).toBeDefined();
      expect(updated.pages['page-1']).toBe('home.md');
    });

    test('updates existing page', () => {
      // Per ADR-0024: pages is now Record<string, string>
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {
          'page-1': 'home.md',
        },
      };

      const updated = updatePageSyncInfo(config, {
        pageId: 'page-1',
        localPath: 'new-home.md',
      });

      expect(updated.pages['page-1']).toBe('new-home.md');
    });

    test('does not mutate original config', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const updated = updatePageSyncInfo(config, {
        pageId: 'page-1',
        localPath: 'home.md',
      });

      expect(Object.keys(config.pages)).toHaveLength(0);
      expect(updated).not.toBe(config);
    });
  });

  describe('removePageSyncInfo', () => {
    test('removes existing page', () => {
      // Per ADR-0024: pages is now Record<string, string>
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {
          'page-1': 'home.md',
          'page-2': 'getting-started.md',
        },
      };

      const updated = removePageSyncInfo(config, 'page-1');

      expect(updated.pages['page-1']).toBeUndefined();
      expect(updated.pages['page-2']).toBeDefined();
    });

    test('does nothing for non-existent page', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const updated = removePageSyncInfo(config, 'page-1');

      expect(Object.keys(updated.pages)).toHaveLength(0);
    });
  });

  describe('getTrackedPageIds', () => {
    test('returns all tracked page IDs', () => {
      // Per ADR-0024: pages is now Record<string, string>
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {
          'page-1': 'home.md',
          'page-2': 'getting-started.md',
          'page-3': 'api.md',
        },
      };

      const ids = getTrackedPageIds(config);

      expect(ids).toHaveLength(3);
      expect(ids).toContain('page-1');
      expect(ids).toContain('page-2');
      expect(ids).toContain('page-3');
    });

    test('returns empty array for no pages', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const ids = getTrackedPageIds(config);

      expect(ids).toHaveLength(0);
    });
  });

  describe('updateFolderSyncInfo', () => {
    test('adds new folder', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const folderInfo: FolderSyncInfo = {
        folderId: 'folder-1',
        title: 'docs',
        localPath: 'docs',
      };

      const updated = updateFolderSyncInfo(config, folderInfo);

      expect(updated.folders).toBeDefined();
      expect(updated.folders?.['folder-1']).toBeDefined();
      expect(updated.folders?.['folder-1'].title).toBe('docs');
      expect(updated.folders?.['folder-1'].localPath).toBe('docs');
    });

    test('updates existing folder', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
        folders: {
          'folder-1': {
            folderId: 'folder-1',
            title: 'docs',
            localPath: 'docs',
          },
        },
      };

      const folderInfo: FolderSyncInfo = {
        folderId: 'folder-1',
        title: 'documentation',
        localPath: 'docs',
      };

      const updated = updateFolderSyncInfo(config, folderInfo);

      expect(updated.folders?.['folder-1'].title).toBe('documentation');
    });

    test('does not mutate original config', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const folderInfo: FolderSyncInfo = {
        folderId: 'folder-1',
        title: 'docs',
        localPath: 'docs',
      };

      const updated = updateFolderSyncInfo(config, folderInfo);

      expect(config.folders).toBeUndefined();
      expect(updated).not.toBe(config);
    });
  });

  describe('getFolderByPath', () => {
    test('returns folder matching path', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
        folders: {
          'folder-1': { folderId: 'folder-1', title: 'docs', localPath: 'docs' },
          'folder-2': { folderId: 'folder-2', title: 'api', parentId: 'folder-1', localPath: 'docs/api' },
        },
      };

      const folder = getFolderByPath(config, 'docs/api');

      expect(folder).toBeDefined();
      expect(folder?.folderId).toBe('folder-2');
      expect(folder?.title).toBe('api');
    });

    test('returns undefined for non-existent path', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
        folders: {
          'folder-1': { folderId: 'folder-1', title: 'docs', localPath: 'docs' },
        },
      };

      const folder = getFolderByPath(config, 'nonexistent');

      expect(folder).toBeUndefined();
    });

    test('returns undefined when no folders exist', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const folder = getFolderByPath(config, 'docs');

      expect(folder).toBeUndefined();
    });
  });

  describe('getFolderById', () => {
    test('returns folder by ID', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
        folders: {
          'folder-1': { folderId: 'folder-1', title: 'docs', localPath: 'docs' },
          'folder-2': { folderId: 'folder-2', title: 'api', localPath: 'docs/api' },
        },
      };

      const folder = getFolderById(config, 'folder-1');

      expect(folder).toBeDefined();
      expect(folder?.title).toBe('docs');
    });

    test('returns undefined for non-existent ID', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
        folders: {
          'folder-1': { folderId: 'folder-1', title: 'docs', localPath: 'docs' },
        },
      };

      const folder = getFolderById(config, 'nonexistent');

      expect(folder).toBeUndefined();
    });
  });

  describe('removeFolderSyncInfo', () => {
    test('removes existing folder', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
        folders: {
          'folder-1': { folderId: 'folder-1', title: 'docs', localPath: 'docs' },
          'folder-2': { folderId: 'folder-2', title: 'api', localPath: 'docs/api' },
        },
      };

      const updated = removeFolderSyncInfo(config, 'folder-1');

      expect(updated.folders?.['folder-1']).toBeUndefined();
      expect(updated.folders?.['folder-2']).toBeDefined();
    });

    test('does nothing for non-existent folder', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
        folders: {},
      };

      const updated = removeFolderSyncInfo(config, 'folder-1');

      expect(Object.keys(updated.folders || {})).toHaveLength(0);
    });

    test('handles config with no folders field', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const updated = removeFolderSyncInfo(config, 'folder-1');

      expect(updated.folders).toBeUndefined();
    });
  });
});
