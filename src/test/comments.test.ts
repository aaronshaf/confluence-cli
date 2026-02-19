import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { server } from './setup-msw.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('ConfluenceClient - getFooterComments', () => {
  test('returns empty comments by default', async () => {
    const client = new ConfluenceClient(testConfig);
    const response = await client.getFooterComments('page-123');
    expect(response.results).toBeArray();
    expect(response.results.length).toBe(0);
  });

  test('returns comments when present', async () => {
    server.use(
      http.get('*/wiki/api/v2/pages/:pageId/footer-comments', () => {
        return HttpResponse.json({
          results: [
            {
              id: 'comment-1',
              body: { storage: { value: '<p>Test comment</p>', representation: 'storage' } },
              authorId: 'user-123',
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    const response = await client.getFooterComments('page-123');
    expect(response.results.length).toBe(1);
    expect(response.results[0].id).toBe('comment-1');
    expect(response.results[0].body?.storage?.value).toContain('Test comment');
  });

  test('throws on API error', async () => {
    server.use(
      http.get('*/wiki/api/v2/pages/:pageId/footer-comments', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.getFooterComments('page-123')).rejects.toThrow();
  });
});
