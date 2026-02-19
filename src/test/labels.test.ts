import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { server } from './setup-msw.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('ConfluenceClient - label operations', () => {
  test('lists labels for a page', async () => {
    server.use(
      http.get('*/wiki/api/v2/pages/:pageId/labels', () => {
        return HttpResponse.json({
          results: [
            { id: 'label-1', name: 'documentation', prefix: 'global' },
            { id: 'label-2', name: 'draft', prefix: 'global' },
          ],
        });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    const labels = await client.getAllLabels('page-123');
    expect(labels.length).toBe(2);
    expect(labels[0].name).toBe('documentation');
    expect(labels[1].name).toBe('draft');
  });

  test('adds a label', async () => {
    let requestBody: unknown;
    server.use(
      http.post('*/wiki/rest/api/content/:pageId/label', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json([]);
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await client.addLabel('page-123', 'documentation');
    expect(requestBody).toEqual([{ prefix: 'global', name: 'documentation' }]);
  });

  test('removes a label', async () => {
    let deletedLabel = '';
    server.use(
      http.delete('*/wiki/rest/api/content/:pageId/label/:labelName', ({ params }) => {
        deletedLabel = params.labelName as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await client.removeLabel('page-123', 'draft');
    expect(deletedLabel).toBe('draft');
  });

  test('throws on 401 when adding label', async () => {
    server.use(
      http.post('*/wiki/rest/api/content/:pageId/label', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.addLabel('page-123', 'documentation')).rejects.toThrow();
  });
});
