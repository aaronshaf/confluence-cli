import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { createValidSpace } from './msw-schema-validation.js';
import { server } from './setup-msw.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('ConfluenceClient - spaces', () => {
  test('lists spaces', async () => {
    const client = new ConfluenceClient(testConfig);
    const response = await client.getSpaces();
    expect(response.results).toBeArray();
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0]).toHaveProperty('key');
    expect(response.results[0]).toHaveProperty('name');
  });

  test('returns specific space by key', async () => {
    server.use(
      http.get('*/wiki/api/v2/spaces', ({ request }) => {
        const url = new URL(request.url);
        const keys = url.searchParams.get('keys');
        if (keys === 'DOCS') {
          return HttpResponse.json({
            results: [createValidSpace({ id: 'space-docs', key: 'DOCS', name: 'Documentation' })],
          });
        }
        return HttpResponse.json({ results: [] });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    const space = await client.getSpaceByKey('DOCS');
    expect(space.key).toBe('DOCS');
    expect(space.name).toBe('Documentation');
  });

  test('throws on 401', async () => {
    server.use(
      http.get('*/wiki/api/v2/spaces', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.getSpaces()).rejects.toThrow();
  });
});
