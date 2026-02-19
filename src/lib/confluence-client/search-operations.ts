import { Effect, Schema, pipe } from 'effect';
import { ApiError, AuthError, NetworkError, RateLimitError } from '../errors.js';
import { SearchResponseSchema, type SearchResponse } from './types.js';

/** Retry schedule shared with client — exponential backoff capped at ~160s */
import { Schedule } from 'effect';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const rateLimitRetrySchedule = Schedule.exponential(BASE_DELAY_MS).pipe(
  Schedule.jittered,
  Schedule.whileInput((error: unknown) => error instanceof RateLimitError),
  Schedule.upTo(MAX_RETRIES * BASE_DELAY_MS * 32),
);

/**
 * Search pages using CQL (Effect version)
 * Uses GET /wiki/rest/api/search (v1 API - not prefixed with /api/v2)
 */
export function searchEffect(
  baseUrl: string,
  authHeader: string,
  cql: string,
  limit = 10,
  start = 0,
): Effect.Effect<SearchResponse, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=${limit}&start=${start}`;

  const makeRequest = Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError('Rate limited', retryAfter ? Number.parseInt(retryAfter, 10) : undefined);
      }
      if (response.status === 401) throw new AuthError('Invalid credentials', 401);
      if (response.status === 403) throw new AuthError('Access denied', 403);
      if (!response.ok) {
        const errorText = await response.text();
        throw new ApiError(`Search failed: ${response.status} ${errorText}`, response.status);
      }
      return response.json();
    },
    catch: (error) => {
      if (error instanceof RateLimitError || error instanceof AuthError || error instanceof ApiError) return error;
      return new NetworkError(`Network error: ${error}`);
    },
  });

  return pipe(
    makeRequest,
    Effect.flatMap((data) =>
      Schema.decodeUnknown(SearchResponseSchema)(data).pipe(
        Effect.mapError((e) => new ApiError(`Invalid response: ${e}`, 500)),
      ),
    ),
    Effect.retry(rateLimitRetrySchedule),
  );
}
