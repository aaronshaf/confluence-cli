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
  type SpaceConfigWithState,
  type PageSyncInfo,
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
      const testConfig: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        lastSync: '2024-01-01T00:00:00Z',
        pages: {
          'page-1': {
            pageId: 'page-1',
            version: 1,
            localPath: 'home.md',
          },
        },
      };

      const configPath = join(testDir, '.confluence.json');
      writeFileSync(configPath, JSON.stringify(testConfig));

      const config = readSpaceConfig(testDir);

      expect(config).not.toBeNull();
      expect(config?.spaceKey).toBe('TEST');
      expect(config?.spaceName).toBe('Test Space');
      expect(config?.pages['page-1'].localPath).toBe('home.md');
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

      const pageInfo: PageSyncInfo = {
        pageId: 'page-1',
        version: 1,
        localPath: 'home.md',
      };

      const updated = updatePageSyncInfo(config, pageInfo);

      expect(updated.pages['page-1']).toBeDefined();
      expect(updated.pages['page-1'].version).toBe(1);
      expect(updated.pages['page-1'].localPath).toBe('home.md');
    });

    test('updates existing page', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {
          'page-1': {
            pageId: 'page-1',
            version: 1,
            localPath: 'home.md',
          },
        },
      };

      const pageInfo: PageSyncInfo = {
        pageId: 'page-1',
        version: 2,
        localPath: 'home.md',
      };

      const updated = updatePageSyncInfo(config, pageInfo);

      expect(updated.pages['page-1'].version).toBe(2);
    });

    test('does not mutate original config', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {},
      };

      const pageInfo: PageSyncInfo = {
        pageId: 'page-1',
        version: 1,
        localPath: 'home.md',
      };

      const updated = updatePageSyncInfo(config, pageInfo);

      expect(Object.keys(config.pages)).toHaveLength(0);
      expect(updated).not.toBe(config);
    });
  });

  describe('removePageSyncInfo', () => {
    test('removes existing page', () => {
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {
          'page-1': {
            pageId: 'page-1',
            version: 1,
            localPath: 'home.md',
          },
          'page-2': {
            pageId: 'page-2',
            version: 1,
            localPath: 'getting-started.md',
          },
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
      const config: SpaceConfigWithState = {
        spaceKey: 'TEST',
        spaceId: 'space-123',
        spaceName: 'Test Space',
        pages: {
          'page-1': { pageId: 'page-1', version: 1, localPath: 'home.md' },
          'page-2': { pageId: 'page-2', version: 1, localPath: 'getting-started.md' },
          'page-3': { pageId: 'page-3', version: 1, localPath: 'api.md' },
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
});
