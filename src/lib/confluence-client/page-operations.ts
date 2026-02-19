/**
 * Page mutation operations for Confluence
 * Extracted from client.ts for file size management
 */

import { Effect, pipe, Schedule, Schema } from 'effect';
import {
  ApiError,
  AuthError,
  NetworkError,
  PageNotFoundError,
  RateLimitError,
  VersionConflictError,
} from '../errors.js';
import {
  PageSchema,
  type CreatePageRequest,
  type Page,
  type UpdatePageRequest,
  type VersionConflictResponse,
} from './types.js';

/**
 * Retry configuration for rate limiting
 */
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const rateLimitRetrySchedule = Schedule.exponential(BASE_DELAY_MS).pipe(
  Schedule.jittered,
  Schedule.whileInput((error: unknown) => error instanceof RateLimitError),
  Schedule.upTo(MAX_RETRIES * BASE_DELAY_MS * 32),
);

/**
 * Create a new page (Effect version)
 */
export function createPageEffect(
  baseUrl: string,
  authHeader: string,
  request: CreatePageRequest,
): Effect.Effect<Page, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/api/v2/pages`;

  const makeRequest = Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          'Rate limited by Confluence API',
          retryAfter ? Number.parseInt(retryAfter, 10) : undefined,
        );
      }

      if (response.status === 401) {
        throw new AuthError('Invalid credentials. Please check your email and API token.', 401);
      }

      if (response.status === 403) {
        throw new AuthError('Access denied. Please check your permissions.', 403);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new ApiError(`API request failed: ${response.status} ${errorText}`, response.status);
      }

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
      Schema.decodeUnknown(PageSchema)(data).pipe(Effect.mapError((e) => new ApiError(`Invalid response: ${e}`, 500))),
    ),
    Effect.retry(rateLimitRetrySchedule),
  );
}

/**
 * Update a page (Effect version)
 * Uses PUT /wiki/api/v2/pages/{id} endpoint
 */
export function updatePageEffect(
  baseUrl: string,
  authHeader: string,
  request: UpdatePageRequest,
): Effect.Effect<
  Page,
  ApiError | AuthError | NetworkError | RateLimitError | PageNotFoundError | VersionConflictError
> {
  const url = `${baseUrl}/wiki/api/v2/pages/${request.id}`;

  const makeRequest = Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          'Rate limited by Confluence API',
          retryAfter ? Number.parseInt(retryAfter, 10) : undefined,
        );
      }

      if (response.status === 401) {
        throw new AuthError('Invalid credentials. Please check your email and API token.', 401);
      }

      if (response.status === 403) {
        throw new AuthError('Access denied. Please check your permissions.', 403);
      }

      if (response.status === 404) {
        throw new PageNotFoundError(request.id);
      }

      if (response.status === 409) {
        // Version conflict - the remote version has changed
        const errorData: VersionConflictResponse = await response.json().catch(() => ({}));
        const remoteVersion = errorData?.version?.number ?? 0;
        throw new VersionConflictError(request.version.number, remoteVersion);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new ApiError(`API request failed: ${response.status} ${errorText}`, response.status);
      }

      return response.json();
    },
    catch: (error) => {
      if (
        error instanceof RateLimitError ||
        error instanceof AuthError ||
        error instanceof ApiError ||
        error instanceof PageNotFoundError ||
        error instanceof VersionConflictError
      ) {
        return error;
      }
      return new NetworkError(`Network error: ${error}`);
    },
  });

  return pipe(
    makeRequest,
    Effect.flatMap((data) =>
      Schema.decodeUnknown(PageSchema)(data).pipe(Effect.mapError((e) => new ApiError(`Invalid response: ${e}`, 500))),
    ),
    Effect.retry(rateLimitRetrySchedule),
  );
}

/**
 * Set a content property on a page (Effect version)
 */
export function setContentPropertyEffect(
  baseUrl: string,
  authHeader: string,
  pageId: string,
  key: string,
  value: unknown,
): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
  const url = `${baseUrl}/wiki/api/v2/pages/${pageId}/properties`;

  const makeRequest = Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError('Rate limited', retryAfter ? Number.parseInt(retryAfter, 10) : undefined);
      }

      if (response.status === 401) throw new AuthError('Authentication failed', 401);
      if (response.status === 403) throw new AuthError('Permission denied', 403);
      if (!response.ok) throw new ApiError(`Failed to set content property: ${await response.text()}`, response.status);
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
 * Delete a page (Effect version)
 * Uses DELETE /wiki/api/v2/pages/{id} endpoint
 */
export function deletePageEffect(
  baseUrl: string,
  authHeader: string,
  pageId: string,
): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError | PageNotFoundError> {
  const url = `${baseUrl}/wiki/api/v2/pages/${pageId}`;

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
      if (response.status === 404) throw new PageNotFoundError(pageId);
      if (response.status !== 204 && !response.ok) {
        throw new ApiError(`Failed to delete page: ${await response.text()}`, response.status);
      }
    },
    catch: (error) => {
      if (
        error instanceof RateLimitError ||
        error instanceof AuthError ||
        error instanceof ApiError ||
        error instanceof PageNotFoundError
      ) {
        return error;
      }
      return new NetworkError(`Network error: ${error}`);
    },
  });

  return pipe(makeRequest, Effect.retry(rateLimitRetrySchedule));
}
