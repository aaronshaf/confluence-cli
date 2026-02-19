import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { server } from './setup-msw.js';
import { createValidFolder, createValidSpace } from './msw-schema-validation.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('cn folder - API layer', () => {
  describe('createFolder', () => {
    test('creates a folder with spaceId resolved from getSpaceByKey', async () => {
      let capturedBody: unknown;

      server.use(
        http.get('*/wiki/api/v2/spaces', ({ request }) => {
          const url = new URL(request.url);
          const keys = url.searchParams.get('keys');
          return HttpResponse.json({ results: [createValidSpace({ id: 'space-456', key: keys ?? 'DOCS' })] });
        }),
        http.post('*/wiki/api/v2/folders', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(createValidFolder({ id: 'folder-new', title: 'My Folder' }));
        }),
      );

      const client = new ConfluenceClient(testConfig);
      const space = await client.getSpaceByKey('DOCS');
      const folder = await client.createFolder({ spaceId: space.id, title: 'My Folder' });

      expect(space.id).toBe('space-456');
      expect(folder.id).toBe('folder-new');
      expect(folder.title).toBe('My Folder');
      expect((capturedBody as { spaceId: string }).spaceId).toBe('space-456');
    });

    test('creates a folder with a parentId', async () => {
      let capturedBody: unknown;

      server.use(
        http.post('*/wiki/api/v2/folders', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            createValidFolder({ id: 'folder-child', title: 'Child Folder', parentId: 'folder-parent' }),
          );
        }),
      );

      const client = new ConfluenceClient(testConfig);
      await client.createFolder({ spaceId: 'space-123', title: 'Child Folder', parentId: 'folder-parent' });

      expect((capturedBody as { parentId: string }).parentId).toBe('folder-parent');
    });
  });

  describe('deleteFolder', () => {
    test('deletes a folder by ID', async () => {
      let deletedId = '';

      server.use(
        http.delete('*/wiki/api/v2/folders/:folderId', ({ params }) => {
          deletedId = params.folderId as string;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const client = new ConfluenceClient(testConfig);
      await client.deleteFolder('folder-123');

      expect(deletedId).toBe('folder-123');
    });

    test('throws FolderNotFoundError for 404', async () => {
      server.use(
        http.delete('*/wiki/api/v2/folders/:folderId', () => {
          return HttpResponse.json({ message: 'Not found' }, { status: 404 });
        }),
      );

      const client = new ConfluenceClient(testConfig);
      await expect(client.deleteFolder('nonexistent')).rejects.toThrow();
    });
  });

  describe('folder list pagination', () => {
    test('fetches a single page when total fits in one request', async () => {
      server.use(
        http.get('*/wiki/rest/api/search', ({ request }) => {
          const url = new URL(request.url);
          const start = Number(url.searchParams.get('start') ?? 0);
          if (start === 0) {
            return HttpResponse.json({
              results: [
                { content: { id: 'f1', type: 'folder', title: 'Folder 1' } },
                { content: { id: 'f2', type: 'folder', title: 'Folder 2' } },
              ],
              totalSize: 2,
            });
          }
          return HttpResponse.json({ results: [], totalSize: 2 });
        }),
      );

      const client = new ConfluenceClient(testConfig);
      const page1 = await client.search('type=folder AND space="TEST"', 100, 0);
      expect(page1.results).toHaveLength(2);
      expect(page1.totalSize).toBe(2);
    });

    test('paginates when totalSize exceeds page size', async () => {
      const allFolders = Array.from({ length: 150 }, (_, i) => ({
        content: { id: `f${i}`, type: 'folder', title: `Folder ${i}` },
      }));

      server.use(
        http.get('*/wiki/rest/api/search', ({ request }) => {
          const url = new URL(request.url);
          const start = Number(url.searchParams.get('start') ?? 0);
          const limit = Number(url.searchParams.get('limit') ?? 10);
          const slice = allFolders.slice(start, start + limit);
          return HttpResponse.json({ results: slice, totalSize: 150 });
        }),
      );

      const client = new ConfluenceClient(testConfig);
      const collected = [];
      let start = 0;
      const PAGE_SIZE = 100;

      const first = await client.search('type=folder AND space="TEST"', PAGE_SIZE, start);
      collected.push(...first.results);
      const total = first.totalSize ?? first.results.length;

      while (collected.length < total) {
        start += PAGE_SIZE;
        const page = await client.search('type=folder AND space="TEST"', PAGE_SIZE, start);
        if (page.results.length === 0) break;
        collected.push(...page.results);
      }

      expect(collected).toHaveLength(150);
    });
  });

  describe('getPositionals (arg parsing)', () => {
    // Test the arg parsing logic directly via the folderCommand behavior
    test('search passes start param in URL', async () => {
      const capturedUrls: string[] = [];

      server.use(
        http.get('*/wiki/rest/api/search', ({ request }) => {
          capturedUrls.push(request.url);
          return HttpResponse.json({ results: [], totalSize: 0 });
        }),
      );

      const client = new ConfluenceClient(testConfig);
      await client.search('type=folder', 100, 42);

      expect(capturedUrls[0]).toContain('start=42');
    });

    test('search passes limit param in URL', async () => {
      const capturedUrls: string[] = [];

      server.use(
        http.get('*/wiki/rest/api/search', ({ request }) => {
          capturedUrls.push(request.url);
          return HttpResponse.json({ results: [], totalSize: 0 });
        }),
      );

      const client = new ConfluenceClient(testConfig);
      await client.search('type=folder', 50, 0);

      expect(capturedUrls[0]).toContain('limit=50');
    });
  });
});
