import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { createValidPage } from './msw-schema-validation.js';
import { server } from './setup-msw.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('ConfluenceClient - getPage (info)', () => {
  test('returns page without body when includeBody=false', async () => {
    const page = createValidPage({ id: 'page-123', title: 'My Page' });
    server.use(
      http.get('*/wiki/api/v2/pages/:pageId', () => {
        return HttpResponse.json(page);
      }),
    );

    const client = new ConfluenceClient(testConfig);
    const result = await client.getPage('page-123', false);
    expect(result.id).toBe('page-123');
    expect(result.title).toBe('My Page');
  });

  test('returns labels for a page', async () => {
    server.use(
      http.get('*/wiki/api/v2/pages/:pageId/labels', () => {
        return HttpResponse.json({
          results: [
            { id: 'lbl-1', name: 'docs', prefix: 'global' },
            { id: 'lbl-2', name: 'public', prefix: 'global' },
          ],
        });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    const labels = await client.getAllLabels('page-123');
    expect(labels.length).toBe(2);
    expect(labels[0].name).toBe('docs');
  });

  test('throws on 404', async () => {
    server.use(
      http.get('*/wiki/api/v2/pages/:pageId', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.getPage('nonexistent', false)).rejects.toThrow();
  });
});
