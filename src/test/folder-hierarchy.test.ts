import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import {
  determineExpectedParent,
  ensureFolderHierarchy,
  FolderHierarchyError,
  sanitizeFolderTitle,
} from '../cli/commands/folder-hierarchy.js';
import type { SpaceConfigWithState } from '../lib/space-config.js';
import { server } from './setup-msw.js';
import { createValidFolder } from './msw-schema-validation.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('folder-hierarchy', () => {
  describe('sanitizeFolderTitle', () => {
    test('returns unchanged title for valid names', () => {
      const result = sanitizeFolderTitle('My Folder');
      expect(result.sanitized).toBe('My Folder');
      expect(result.wasModified).toBe(false);
    });

    test('replaces pipe character', () => {
      const result = sanitizeFolderTitle('Folder | Name');
      expect(result.sanitized).toBe('Folder - Name');
      expect(result.wasModified).toBe(true);
    });

    test('replaces backslash', () => {
      const result = sanitizeFolderTitle('Folder\\Name');
      expect(result.sanitized).toBe('Folder-Name');
      expect(result.wasModified).toBe(true);
    });

    test('replaces forward slash', () => {
      const result = sanitizeFolderTitle('Folder/Name');
      expect(result.sanitized).toBe('Folder-Name');
      expect(result.wasModified).toBe(true);
    });

    test('replaces colon', () => {
      const result = sanitizeFolderTitle('Folder: Name');
      expect(result.sanitized).toBe('Folder- Name');
      expect(result.wasModified).toBe(true);
    });

    test('replaces asterisk', () => {
      const result = sanitizeFolderTitle('Folder*Name');
      expect(result.sanitized).toBe('Folder-Name');
      expect(result.wasModified).toBe(true);
    });

    test('replaces question mark', () => {
      const result = sanitizeFolderTitle('Folder?Name');
      expect(result.sanitized).toBe('Folder-Name');
      expect(result.wasModified).toBe(true);
    });

    test('replaces double quotes', () => {
      const result = sanitizeFolderTitle('Folder"Name');
      expect(result.sanitized).toBe('Folder-Name');
      expect(result.wasModified).toBe(true);
    });

    test('replaces angle brackets', () => {
      const result = sanitizeFolderTitle('Folder<Name>');
      expect(result.sanitized).toBe('Folder-Name-');
      expect(result.wasModified).toBe(true);
    });

    test('replaces multiple invalid characters', () => {
      const result = sanitizeFolderTitle('A|B/C:D*E?F"G<H>I');
      expect(result.sanitized).toBe('A-B-C-D-E-F-G-H-I');
      expect(result.wasModified).toBe(true);
    });

    test('trims whitespace', () => {
      const result = sanitizeFolderTitle('  Folder Name  ');
      expect(result.sanitized).toBe('Folder Name');
      expect(result.wasModified).toBe(true);
    });
  });

  describe('ensureFolderHierarchy', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = mkdtempSync(join(tmpdir(), 'cn-folder-hierarchy-test-'));
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
    });

    const createSpaceConfig = (overrides?: Partial<SpaceConfigWithState>): SpaceConfigWithState => ({
      spaceKey: 'TEST',
      spaceId: 'space-123',
      spaceName: 'Test Space',
      pages: {},
      folders: {},
      ...overrides,
    });

    test('returns undefined parentId for root-level files', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig();

      const result = await ensureFolderHierarchy(client, spaceConfig, testDir, 'readme.md', true);

      expect(result.parentId).toBeUndefined();
      expect(result.updatedConfig).toEqual(spaceConfig);
    });

    test('returns undefined parentId for files with ./ prefix at root', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig();

      const result = await ensureFolderHierarchy(client, spaceConfig, testDir, './readme.md', true);

      expect(result.parentId).toBeUndefined();
    });

    test('returns existing folder ID from local config', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig({
        folders: {
          'folder-abc': {
            folderId: 'folder-abc',
            title: 'docs',
            localPath: 'docs',
          },
        },
      });

      const result = await ensureFolderHierarchy(client, spaceConfig, testDir, 'docs/guide.md', true);

      expect(result.parentId).toBe('folder-abc');
    });

    test('returns nested folder ID from local config', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig({
        folders: {
          'folder-docs': {
            folderId: 'folder-docs',
            title: 'docs',
            localPath: 'docs',
          },
          'folder-api': {
            folderId: 'folder-api',
            title: 'api',
            parentId: 'folder-docs',
            localPath: 'docs/api',
          },
        },
      });

      const result = await ensureFolderHierarchy(client, spaceConfig, testDir, 'docs/api/endpoints.md', true);

      expect(result.parentId).toBe('folder-api');
    });

    test('throws error for path traversal attempts', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig();

      try {
        await ensureFolderHierarchy(client, spaceConfig, testDir, '../etc/passwd', true);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FolderHierarchyError);
        expect((error as FolderHierarchyError).message).toContain('path traversal');
      }
    });

    test('throws error for deeply nested paths exceeding max depth', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig();

      // Create a path with 11 levels (exceeds MAX_FOLDER_DEPTH of 10)
      const deepPath = 'a/b/c/d/e/f/g/h/i/j/k/file.md';

      try {
        await ensureFolderHierarchy(client, spaceConfig, testDir, deepPath, true);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FolderHierarchyError);
        expect((error as FolderHierarchyError).message).toContain('too deep');
      }
    });

    test('dry run returns undefined when folder needs creation', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig();

      // Mock: folder does not exist on Confluence
      server.use(
        http.get('*/wiki/api/v2/spaces/space-123/folders', () => {
          return HttpResponse.json({ results: [] });
        }),
      );

      const result = await ensureFolderHierarchy(client, spaceConfig, testDir, 'newdir/file.md', true);

      // Dry run can't continue without a real folder ID
      expect(result.parentId).toBeUndefined();
    });
  });

  describe('determineExpectedParent', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = mkdtempSync(join(tmpdir(), 'cn-determine-parent-test-'));
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
    });

    const createSpaceConfig = (overrides?: Partial<SpaceConfigWithState>): SpaceConfigWithState => ({
      spaceKey: 'TEST',
      spaceId: 'space-123',
      spaceName: 'Test Space',
      pages: {},
      folders: {},
      ...overrides,
    });

    test('returns undefined parentId for root-level files', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig();

      const result = await determineExpectedParent(client, spaceConfig, testDir, 'readme.md', true);

      expect(result.parentId).toBeUndefined();
      expect(result.updatedConfig).toEqual(spaceConfig);
    });

    test('returns undefined for files with . directory', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig();

      // This tests the early return for dirPath === '.'
      const result = await determineExpectedParent(client, spaceConfig, testDir, './file.md', true);

      expect(result.parentId).toBeUndefined();
    });

    test('returns existing folder ID for nested file', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig({
        folders: {
          'folder-xyz': {
            folderId: 'folder-xyz',
            title: 'docs',
            localPath: 'docs',
          },
        },
      });

      const result = await determineExpectedParent(client, spaceConfig, testDir, 'docs/page.md', true);

      expect(result.parentId).toBe('folder-xyz');
    });

    test('returns deeply nested folder ID', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig({
        folders: {
          'folder-docs': {
            folderId: 'folder-docs',
            title: 'docs',
            localPath: 'docs',
          },
          'folder-api': {
            folderId: 'folder-api',
            title: 'api',
            parentId: 'folder-docs',
            localPath: 'docs/api',
          },
          'folder-v2': {
            folderId: 'folder-v2',
            title: 'v2',
            parentId: 'folder-api',
            localPath: 'docs/api/v2',
          },
        },
      });

      const result = await determineExpectedParent(client, spaceConfig, testDir, 'docs/api/v2/endpoints.md', true);

      expect(result.parentId).toBe('folder-v2');
    });

    test('handles path normalization with ./ prefix', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig({
        folders: {
          'folder-docs': {
            folderId: 'folder-docs',
            title: 'docs',
            localPath: 'docs',
          },
        },
      });

      const result = await determineExpectedParent(client, spaceConfig, testDir, './docs/guide.md', true);

      expect(result.parentId).toBe('folder-docs');
    });

    test('propagates FolderHierarchyError from ensureFolderHierarchy', async () => {
      const client = new ConfluenceClient(testConfig);
      const spaceConfig = createSpaceConfig();

      try {
        await determineExpectedParent(client, spaceConfig, testDir, '../outside/file.md', true);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FolderHierarchyError);
      }
    });
  });
});
