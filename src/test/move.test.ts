import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { server } from './setup-msw.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('ConfluenceClient - movePage', () => {
  test('moves page successfully', async () => {
    const client = new ConfluenceClient(testConfig);
    await client.movePage('page-123', 'page-456', 'append');
  });

  test('uses append position by default', async () => {
    let capturedPosition = '';
    server.use(
      http.put('*/wiki/rest/api/content/:pageId/move/:position/:targetId', ({ params }) => {
        capturedPosition = params.position as string;
        return HttpResponse.json({});
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await client.movePage('page-123', 'page-456');
    expect(capturedPosition).toBe('append');
  });

  test('throws on 404', async () => {
    server.use(
      http.put('*/wiki/rest/api/content/:pageId/move/:position/:targetId', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.movePage('nonexistent', 'page-456')).rejects.toThrow();
  });

  test('throws on 401', async () => {
    server.use(
      http.put('*/wiki/rest/api/content/:pageId/move/:position/:targetId', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.movePage('page-123', 'page-456')).rejects.toThrow();
  });
});
