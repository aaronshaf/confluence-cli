import { describe, expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { ConfluenceClient } from '../lib/confluence-client/client.js';
import { createValidAttachment } from './msw-schema-validation.js';
import { server } from './setup-msw.js';

const testConfig = {
  confluenceUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  apiToken: 'test-token',
};

describe('ConfluenceClient - attachment operations', () => {
  test('lists attachments (empty by default)', async () => {
    const client = new ConfluenceClient(testConfig);
    const response = await client.getAttachments('page-123');
    expect(response.results).toBeArray();
    expect(response.results.length).toBe(0);
  });

  test('lists attachments when present', async () => {
    server.use(
      http.get('*/wiki/api/v2/pages/:pageId/attachments', () => {
        return HttpResponse.json({
          results: [createValidAttachment({ id: 'att-1', title: 'image.png', mediaType: 'image/png', fileSize: 2048 })],
        });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    const response = await client.getAttachments('page-123');
    expect(response.results.length).toBe(1);
    expect(response.results[0].id).toBe('att-1');
    expect(response.results[0].title).toBe('image.png');
  });

  test('uploads attachment without throwing', async () => {
    const client = new ConfluenceClient(testConfig);
    await client.uploadAttachment('page-123', 'test.png', Buffer.from('fake-image-data'), 'image/png');
  });

  test('deletes attachment without throwing', async () => {
    const client = new ConfluenceClient(testConfig);
    await client.deleteAttachment('att-123');
  });

  test('throws on 401 when getting attachments', async () => {
    server.use(
      http.get('*/wiki/api/v2/pages/:pageId/attachments', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.getAttachments('page-123')).rejects.toThrow();
  });

  test('throws on 404 when deleting attachment', async () => {
    server.use(
      http.delete('*/wiki/api/v2/attachments/:attachmentId', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      }),
    );

    const client = new ConfluenceClient(testConfig);
    await expect(client.deleteAttachment('nonexistent')).rejects.toThrow();
  });
});
