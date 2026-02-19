import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { server } from './setup-msw.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('ConfluenceClient - search', () => {
  test('returns search results', async () => {
    const client = new ConfluenceClient(testConfig);
    const response = await client.search('type=page AND text~"test"');
    expect(response.results).toBeArray();
  });

  test('returns empty results for folder-type CQL', async () => {
    const client = new ConfluenceClient(testConfig);
    const response = await client.search('type=folder AND space="TEST"');
    expect(response.results).toBeArray();
    expect(response.results.length).toBe(0);
  });

  test('narrows results with --space flag via CQL', async () => {
    let capturedCql = '';
    server.use(
      http.get('*/wiki/rest/api/search', ({ request }) => {
        const url = new URL(request.url);
        capturedCql = url.searchParams.get('cql') || '';
        return HttpResponse.json({ results: [], totalSize: 0 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await client.search('type=page AND text~"api" AND space="DOCS"');
    expect(capturedCql).toContain('space="DOCS"');
  });

  test('handles empty results gracefully', async () => {
    server.use(
      http.get('*/wiki/rest/api/search', () => {
        return HttpResponse.json({ results: [], totalSize: 0 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    const response = await client.search('type=page AND text~"nonexistent"');
    expect(response.results).toBeArray();
    expect(response.results.length).toBe(0);
  });

  test('throws on API error', async () => {
    server.use(
      http.get('*/wiki/rest/api/search', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.search('type=page AND text~"test"')).rejects.toThrow();
  });
});
