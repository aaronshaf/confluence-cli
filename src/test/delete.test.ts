import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { server } from './setup-msw.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('ConfluenceClient - deletePage', () => {
  test('deletes page successfully (204)', async () => {
    const client = new ConfluenceClient(testConfig);
    await client.deletePage('page-123');
  });

  test('throws on 404', async () => {
    server.use(
      http.delete('*/wiki/api/v2/pages/:pageId', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.deletePage('nonexistent')).rejects.toThrow();
  });

  test('throws on 401', async () => {
    server.use(
      http.delete('*/wiki/api/v2/pages/:pageId', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.deletePage('page-123')).rejects.toThrow();
  });
});
