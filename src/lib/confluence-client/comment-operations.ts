import { Effect, Schema } from 'effect';
import { ApiError, AuthError, NetworkError, type RateLimitError } from '../errors.js';
import { CommentsResponseSchema, type Comment, type CommentsResponse } from './types.js';

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
 * Fetch one page of footer comments (Effect version).
 */
export function getFooterCommentsEffect(
  baseUrl: string,
  authHeader: string,
  path: string,
): Effect.Effect<CommentsResponse, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/api/v2${path}`;
  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
      if (response.status === 401) throw new AuthError('Invalid credentials', 401);
      if (!response.ok) throw new ApiError(`Request failed: ${response.status}`, response.status);
      const data = await response.json();
      return Schema.decodeUnknownSync(CommentsResponseSchema)(data);
    },
    catch: (e) => (e instanceof AuthError || e instanceof ApiError ? e : new NetworkError(String(e))),
  });
}

/**
 * Get all footer comments for a page with cursor pagination (async version).
 */
export async function getAllFooterComments(baseUrl: string, authHeader: string, pageId: string): Promise<Comment[]> {
  const allComments: Comment[] = [];
  let cursor: string | undefined;
  do {
    let path = `/pages/${pageId}/footer-comments?body-format=storage&limit=100`;
    if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
    const url = `${baseUrl}/wiki/api/v2${path}`;
    const response = await fetch(url, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    if (!response.ok) throw new ApiError(`Request failed: ${response.status}`, response.status);
    const data = Schema.decodeUnknownSync(CommentsResponseSchema)(await response.json());
    allComments.push(...data.results);
    cursor = extractCursor(data._links?.next);
  } while (cursor);
  return allComments;
}
