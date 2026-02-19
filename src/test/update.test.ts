import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { server } from './setup-msw.js';
import { createValidPage } from './msw-schema-validation.js';
import { findPositional } from '../cli/utils/args.js';
import { isValidFormat, VALID_FORMATS } from '../cli/utils/stdin.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('ConfluenceClient - updatePage', () => {
  test('updates page successfully', async () => {
    server.use(
      http.put('*/wiki/api/v2/pages/:pageId', async ({ request, params }) => {
        const body = (await request.json()) as { title: string; body: { value: string } };
        const page = createValidPage({
          id: params.pageId as string,
          title: body.title,
          version: 2,
        });
        return HttpResponse.json(page);
      }),
    );

    const client = new ConfluenceClient(testConfig);
    const result = await client.updatePage({
      id: 'page-123',
      status: 'current',
      title: 'Updated Title',
      body: { representation: 'storage', value: '<p>New content</p>' },
      version: { number: 2 },
    });

    expect(result.id).toBe('page-123');
  });

  test('fetches page without body when includeBody=false', async () => {
    let requestUrl = '';
    server.use(
      http.get('*/wiki/api/v2/pages/:pageId', ({ request }) => {
        requestUrl = request.url;
        const page = createValidPage({ id: 'page-123', version: 3 });
        return HttpResponse.json(page);
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await client.getPage('page-123', false);
    expect(requestUrl).not.toContain('body-format');
  });

  test('throws on 404', async () => {
    server.use(
      http.put('*/wiki/api/v2/pages/:pageId', () => {
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(
      client.updatePage({
        id: 'nonexistent',
        status: 'current',
        title: 'Title',
        body: { representation: 'storage', value: '<p>x</p>' },
        version: { number: 2 },
      }),
    ).rejects.toThrow();
  });
});

describe('format validation', () => {
  test('accepts valid formats', () => {
    for (const fmt of VALID_FORMATS) {
      expect(isValidFormat(fmt)).toBe(true);
    }
  });

  test('rejects markdown', () => {
    expect(isValidFormat('markdown')).toBe(false);
  });

  test('rejects unknown format', () => {
    expect(isValidFormat('html')).toBe(false);
  });
});

describe('findPositional', () => {
  test('finds simple positional arg', () => {
    expect(findPositional(['123456'], ['--format', '--title'])).toBe('123456');
  });

  test('skips flag and its value, not confusing them with positional', () => {
    // cn update --title 123 123  =>  subArgs: ['--title', '123', '123']  =>  positional is second 123
    expect(findPositional(['--title', '123', '123'], ['--title'])).toBe('123');
  });

  test('id equals title value — skips by index not value', () => {
    // cn update 123 --title 123  =>  subArgs: ['123', '--title', '123']  =>  positional is first 123
    expect(findPositional(['123', '--title', '123'], ['--title'])).toBe('123');
  });

  test('returns undefined when no positional', () => {
    expect(findPositional(['--title', 'Some Title'], ['--title'])).toBeUndefined();
  });

  test('create: title equals space value', () => {
    // cn create ENG --space ENG  =>  subArgs: ['ENG', '--space', 'ENG']  =>  positional is ENG
    expect(findPositional(['ENG', '--space', 'ENG'], ['--space', '--parent', '--format'])).toBe('ENG');
  });
});
