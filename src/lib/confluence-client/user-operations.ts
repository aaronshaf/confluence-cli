import { Effect, Schema, pipe } from 'effect';
import { Schedule } from 'effect';
import { ApiError, AuthError, NetworkError, RateLimitError } from '../errors.js';
import { UserSchema, type User } from './types.js';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const rateLimitRetrySchedule = Schedule.exponential(BASE_DELAY_MS).pipe(
  Schedule.jittered,
  Schedule.whileInput((error: unknown) => error instanceof RateLimitError),
  Schedule.upTo(MAX_RETRIES * BASE_DELAY_MS * 32),
);

/**
 * Get user information by account ID (Effect version)
 * Uses v1 API as v2 does not have a user endpoint
 */
export function getUserEffect(
  baseUrl: string,
  authHeader: string,
  accountId: string,
): Effect.Effect<User, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/rest/api/user?accountId=${encodeURIComponent(accountId)}`;

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
        throw new ApiError(`API request failed: ${response.status} ${errorText}`, response.status);
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
      Schema.decodeUnknown(UserSchema)(data).pipe(
        Effect.mapError((e) => new ApiError(`Invalid user response: ${e}`, 500)),
      ),
    ),
    Effect.retry(rateLimitRetrySchedule),
  );
}
