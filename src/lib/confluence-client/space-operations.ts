import { Effect, pipe, Schema } from 'effect';
import { ApiError, AuthError, NetworkError, type RateLimitError, SpaceNotFoundError } from '../errors.js';
import { SpaceSchema, SpacesResponseSchema, SpacesV1ResponseSchema, type Space, type SpacesResponse } from './types.js';

function extractCursor(nextLink: string | undefined): string | undefined {
  if (!nextLink) return undefined;
  try {
    const url = new URL(nextLink, 'https://placeholder.invalid');
    return url.searchParams.get('cursor') ?? undefined;
  } catch {
    return undefined;
  }
}

async function fetchV1<T>(baseUrl: string, authHeader: string, path: string, schema: Schema.Schema<T>): Promise<T> {
  const url = `${baseUrl}/wiki/rest/api${path}`;
  const verbose = process.env.CN_DEBUG === '1';
  if (verbose) process.stderr.write(`[debug] fetchV1: ${url}\n`);
  const response = await fetch(url, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(`API request failed: ${response.status} ${errorText}`, response.status);
  }
  const data = await response.json();
  return Effect.runPromise(
    Schema.decodeUnknown(schema)(data).pipe(Effect.mapError((e) => new ApiError(`Invalid response: ${e}`, 500))),
  );
}

export function getSpacesEffect(
  _baseUrl: string,
  _authHeader: string,
  limit: number,
  fetchWithRetryEffect: <T>(
    path: string,
    schema: Schema.Schema<T>,
  ) => Effect.Effect<T, ApiError | AuthError | NetworkError | RateLimitError>,
): Effect.Effect<SpacesResponse, ApiError | AuthError | NetworkError | RateLimitError> {
  return fetchWithRetryEffect(`/spaces?limit=${limit}`, SpacesResponseSchema);
}

export async function getSpaces(
  baseUrl: string,
  authHeader: string,
  limit = 25,
  page = 1,
): Promise<{ results: Space[]; start: number; limit: number; size: number }> {
  const start = (page - 1) * limit;
  const response = await fetchV1(baseUrl, authHeader, `/space?limit=${limit}&start=${start}`, SpacesV1ResponseSchema);
  return {
    ...response,
    results: response.results.map((s) => ({ ...s, id: String(s.id) })),
  };
}

export async function getAllSpaces(
  baseUrl: string,
  _authHeader: string,
  fetchWithRetry: <T>(path: string, schema: Schema.Schema<T>) => Promise<T>,
): Promise<Space[]> {
  const verbose = process.env.CN_DEBUG === '1';
  const allSpaces: Space[] = [];
  let cursor: string | undefined;
  let page = 1;
  do {
    let path = '/spaces?limit=20';
    if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
    if (verbose) process.stderr.write(`[debug] getAllSpaces: fetching page ${page} (${baseUrl}/wiki/api/v2${path})\n`);
    const response = await fetchWithRetry(path, SpacesResponseSchema);
    if (verbose)
      process.stderr.write(
        `[debug] getAllSpaces: got ${response.results.length} spaces, next=${response._links?.next ?? 'none'}\n`,
      );
    allSpaces.push(...response.results);
    cursor = extractCursor(response._links?.next);
    page++;
  } while (cursor);
  if (verbose) process.stderr.write(`[debug] getAllSpaces: done, total=${allSpaces.length}\n`);
  return allSpaces;
}

export function getSpaceByKeyEffect(
  key: string,
  fetchWithRetryEffect: <T>(
    path: string,
    schema: Schema.Schema<T>,
  ) => Effect.Effect<T, ApiError | AuthError | NetworkError | RateLimitError>,
): Effect.Effect<Space, ApiError | AuthError | NetworkError | RateLimitError | SpaceNotFoundError> {
  return pipe(
    fetchWithRetryEffect(`/spaces?keys=${key}&limit=1`, SpacesResponseSchema),
    Effect.flatMap((response) => {
      if (response.results.length === 0) {
        return Effect.fail(new SpaceNotFoundError(key));
      }
      return Effect.succeed(response.results[0]);
    }),
  );
}

export async function getSpaceByKey(
  key: string,
  fetchWithRetry: <T>(path: string, schema: Schema.Schema<T>) => Promise<T>,
): Promise<Space> {
  const response = await fetchWithRetry(`/spaces?keys=${key}&limit=1`, SpacesResponseSchema);
  if (response.results.length === 0) {
    throw new SpaceNotFoundError(key);
  }
  return response.results[0];
}

export function getSpaceByIdEffect(
  id: string,
  baseUrl: string,
  authHeader: string,
): Effect.Effect<Space, ApiError | AuthError | NetworkError | SpaceNotFoundError> {
  return Effect.tryPromise({
    try: async () => {
      const url = `${baseUrl}/wiki/api/v2/spaces/${id}`;
      const response = await fetch(url, { headers: { Authorization: authHeader, Accept: 'application/json' } });
      if (response.status === 404) throw new SpaceNotFoundError(id);
      if (response.status === 401) throw new AuthError('Invalid credentials', 401);
      if (response.status === 403) throw new AuthError('Access denied', 403);
      if (!response.ok) throw new ApiError(`API error: ${response.status}`, response.status);
      return Schema.decodeUnknownSync(SpaceSchema)(await response.json());
    },
    catch: (error) => {
      if (error instanceof SpaceNotFoundError || error instanceof AuthError || error instanceof ApiError) return error;
      return new NetworkError(`Network error: ${error}`);
    },
  });
}
