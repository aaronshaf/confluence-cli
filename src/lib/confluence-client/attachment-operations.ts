/**
 * Attachment operations for Confluence pages
 */

import { Effect, pipe, Schedule, Schema } from 'effect';
import { ApiError, AuthError, NetworkError, RateLimitError } from '../errors.js';
import { AttachmentsResponseSchema, type Attachment, type AttachmentsResponse } from './types.js';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const rateLimitRetrySchedule = Schedule.exponential(BASE_DELAY_MS).pipe(
  Schedule.jittered,
  Schedule.whileInput((error: unknown) => error instanceof RateLimitError),
  Schedule.upTo(MAX_RETRIES * BASE_DELAY_MS * 32),
);

/**
 * Get attachments for a page (Effect version)
 * Uses GET /wiki/api/v2/pages/{pageId}/attachments
 */
export function getAttachmentsEffect(
  baseUrl: string,
  authHeader: string,
  pageId: string,
): Effect.Effect<AttachmentsResponse, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/api/v2/pages/${pageId}/attachments`;

  const makeRequest = Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError('Rate limited', retryAfter ? Number.parseInt(retryAfter, 10) : undefined);
      }

      if (response.status === 401) throw new AuthError('Authentication failed', 401);
      if (response.status === 403) throw new AuthError('Permission denied', 403);
      if (!response.ok) throw new ApiError(`Failed to get attachments: ${await response.text()}`, response.status);

      return response.json();
    },
    catch: (error) => {
      if (error instanceof RateLimitError || error instanceof AuthError || error instanceof ApiError) {
        return error;
      }
      return new NetworkError(`Network error: ${error}`);
    },
  });

  return pipe(
    makeRequest,
    Effect.flatMap((data) =>
      Schema.decodeUnknown(AttachmentsResponseSchema)(data).pipe(
        Effect.mapError((e) => new ApiError(`Invalid response: ${e}`, 500)),
      ),
    ),
    Effect.retry(rateLimitRetrySchedule),
  );
}

/**
 * Upload an attachment to a page (Effect version)
 * Uses POST /wiki/rest/api/content/{pageId}/child/attachment
 * Requires X-Atlassian-Token: no-check header
 */
export function uploadAttachmentEffect(
  baseUrl: string,
  authHeader: string,
  pageId: string,
  filename: string,
  data: Buffer,
  mimeType: string,
): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/rest/api/content/${pageId}/child/attachment`;

  const makeRequest = Effect.tryPromise({
    try: async () => {
      const formData = new FormData();
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: mimeType });
      formData.append('file', blob, filename);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'X-Atlassian-Token': 'no-check',
        },
        body: formData,
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError('Rate limited', retryAfter ? Number.parseInt(retryAfter, 10) : undefined);
      }

      if (response.status === 401) throw new AuthError('Authentication failed', 401);
      if (response.status === 403) throw new AuthError('Permission denied', 403);
      if (!response.ok) throw new ApiError(`Failed to upload attachment: ${await response.text()}`, response.status);
    },
    catch: (error) => {
      if (error instanceof RateLimitError || error instanceof AuthError || error instanceof ApiError) {
        return error;
      }
      return new NetworkError(`Network error: ${error}`);
    },
  });

  return pipe(makeRequest, Effect.retry(rateLimitRetrySchedule));
}

/**
 * Extract cursor from a Confluence API next-page link.
 */
function extractCursor(nextLink: string | undefined): string | undefined {
  if (!nextLink) return undefined;
  try {
    const url = new URL(nextLink, 'https://placeholder.invalid');
    return url.searchParams.get('cursor') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get all attachments for a page with cursor pagination (async version).
 */
export async function getAllAttachments(baseUrl: string, authHeader: string, pageId: string): Promise<Attachment[]> {
  const allAttachments: Attachment[] = [];
  let cursor: string | undefined;
  do {
    let path = `/pages/${pageId}/attachments?limit=100`;
    if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
    const url = `${baseUrl}/wiki/api/v2${path}`;
    const response = await fetch(url, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    if (!response.ok) throw new ApiError(`Request failed: ${response.status}`, response.status);
    const data = Schema.decodeUnknownSync(AttachmentsResponseSchema)(await response.json());
    allAttachments.push(...data.results);
    cursor = extractCursor(data._links?.next);
  } while (cursor);
  return allAttachments;
}

/**
 * Download an attachment by its download link (async version).
 */
export async function downloadAttachment(baseUrl: string, authHeader: string, downloadLink: string): Promise<Buffer> {
  return Effect.runPromise(
    Effect.retry(
      Effect.tryPromise({
        try: async () => {
          const url = `${baseUrl}${downloadLink}`;
          const response = await fetch(url, { headers: { Authorization: authHeader } });
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            throw new RateLimitError('Rate limited', retryAfter ? Number.parseInt(retryAfter, 10) : undefined);
          }
          if (response.status === 401) throw new AuthError('Invalid credentials.', 401);
          if (!response.ok) throw new ApiError(`Download failed: ${response.status}`, response.status);
          return Buffer.from(await response.arrayBuffer());
        },
        catch: (e) =>
          e instanceof RateLimitError || e instanceof AuthError || e instanceof ApiError
            ? e
            : new NetworkError(String(e)),
      }),
      rateLimitRetrySchedule,
    ),
  );
}
/**
 * Delete an attachment (Effect version)
 * Uses DELETE /wiki/api/v2/attachments/{attachmentId}
 */
export function deleteAttachmentEffect(
  baseUrl: string,
  authHeader: string,
  attachmentId: string,
): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/api/v2/attachments/${attachmentId}`;

  const makeRequest = Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError('Rate limited', retryAfter ? Number.parseInt(retryAfter, 10) : undefined);
      }

      if (response.status === 401) throw new AuthError('Authentication failed', 401);
      if (response.status === 403) throw new AuthError('Permission denied', 403);
      if (response.status !== 204 && !response.ok) {
        throw new ApiError(`Failed to delete attachment: ${await response.text()}`, response.status);
      }
    },
    catch: (error) => {
      if (error instanceof RateLimitError || error instanceof AuthError || error instanceof ApiError) {
        return error;
      }
      return new NetworkError(`Network error: ${error}`);
    },
  });

  return pipe(makeRequest, Effect.retry(rateLimitRetrySchedule));
}
