/**
 * Label operations for Confluence pages
 */

import { Effect, pipe, Schedule } from 'effect';
import { ApiError, AuthError, NetworkError, RateLimitError } from '../errors.js';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const rateLimitRetrySchedule = Schedule.exponential(BASE_DELAY_MS).pipe(
  Schedule.jittered,
  Schedule.whileInput((error: unknown) => error instanceof RateLimitError),
  Schedule.upTo(MAX_RETRIES * BASE_DELAY_MS * 32),
);

/**
 * Add a label to a page (Effect version)
 * Uses POST /wiki/rest/api/content/{pageId}/label
 */
export function addLabelEffect(
  baseUrl: string,
  authHeader: string,
  pageId: string,
  labelName: string,
): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/rest/api/content/${pageId}/label`;

  const makeRequest = Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ prefix: 'global', name: labelName }]),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError('Rate limited', retryAfter ? Number.parseInt(retryAfter, 10) : undefined);
      }

      if (response.status === 401) throw new AuthError('Authentication failed', 401);
      if (response.status === 403) throw new AuthError('Permission denied', 403);
      if (!response.ok) throw new ApiError(`Failed to add label: ${await response.text()}`, response.status);
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
 * Remove a label from a page (Effect version)
 * Uses DELETE /wiki/rest/api/content/{pageId}/label/{labelName}
 */
export function removeLabelEffect(
  baseUrl: string,
  authHeader: string,
  pageId: string,
  labelName: string,
): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/rest/api/content/${pageId}/label/${encodeURIComponent(labelName)}`;

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
        throw new ApiError(`Failed to remove label: ${await response.text()}`, response.status);
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
