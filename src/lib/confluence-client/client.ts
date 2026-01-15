import { Effect, pipe, Schedule, Schema } from 'effect';
import type { Config } from '../config.js';
import { ApiError, AuthError, NetworkError, RateLimitError, SpaceNotFoundError } from '../errors.js';
import {
  LabelsResponseSchema,
  PageSchema,
  PagesResponseSchema,
  SpaceSchema,
  SpacesResponseSchema,
  type Label,
  type LabelsResponse,
  type Page,
  type PagesResponse,
  type Space,
  type SpacesResponse,
} from './types.js';

/**
 * Retry configuration for rate limiting
 * Uses exponential backoff with jitter per ADR-0010
 */
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

/**
 * Confluence API v2 client
 * Only supports Confluence Cloud (*.atlassian.net) per ADR-0012
 */
export class ConfluenceClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: Config) {
    this.baseUrl = config.confluenceUrl;
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`;
  }

  /**
   * Make an authenticated API request with retry logic
   */
  private fetchWithRetryEffect<T>(
    path: string,
    schema: Schema.Schema<T>,
    options?: RequestInit,
  ): Effect.Effect<T, ApiError | AuthError | NetworkError | RateLimitError> {
    const url = `${this.baseUrl}/wiki/api/v2${path}`;

    const makeRequest = Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          ...options,
          headers: {
            Authorization: this.authHeader,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...options?.headers,
          },
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

    // Retry schedule with exponential backoff and jitter for rate limits
    const retrySchedule = Schedule.exponential(BASE_DELAY_MS).pipe(
      Schedule.jittered,
      Schedule.whileInput((error: unknown) => error instanceof RateLimitError),
      Schedule.upTo(MAX_RETRIES * BASE_DELAY_MS * 32), // Max total delay
    );

    return pipe(
      makeRequest,
      Effect.flatMap((data) =>
        Schema.decodeUnknown(schema)(data).pipe(Effect.mapError((e) => new ApiError(`Invalid response: ${e}`, 500))),
      ),
      Effect.retry(retrySchedule),
    );
  }

  /**
   * Async wrapper for fetch with retry
   */
  private async fetchWithRetry<T>(path: string, schema: Schema.Schema<T>, options?: RequestInit): Promise<T> {
    return Effect.runPromise(this.fetchWithRetryEffect(path, schema, options));
  }

  // ================== Spaces API ==================

  /**
   * Get all spaces (Effect version)
   */
  getSpacesEffect(limit = 25): Effect.Effect<SpacesResponse, ApiError | AuthError | NetworkError | RateLimitError> {
    return this.fetchWithRetryEffect(`/spaces?limit=${limit}`, SpacesResponseSchema);
  }

  /**
   * Get all spaces (async version)
   */
  async getSpaces(limit = 25): Promise<SpacesResponse> {
    return this.fetchWithRetry(`/spaces?limit=${limit}`, SpacesResponseSchema);
  }

  /**
   * Get a space by key (Effect version)
   */
  getSpaceByKeyEffect(
    key: string,
  ): Effect.Effect<Space, ApiError | AuthError | NetworkError | RateLimitError | SpaceNotFoundError> {
    return pipe(
      this.fetchWithRetryEffect(`/spaces?keys=${key}&limit=1`, SpacesResponseSchema),
      Effect.flatMap((response) => {
        if (response.results.length === 0) {
          return Effect.fail(new SpaceNotFoundError(key));
        }
        return Effect.succeed(response.results[0]);
      }),
    );
  }

  /**
   * Get a space by key (async version)
   */
  async getSpaceByKey(key: string): Promise<Space> {
    const response = await this.fetchWithRetry(`/spaces?keys=${key}&limit=1`, SpacesResponseSchema);
    if (response.results.length === 0) {
      throw new SpaceNotFoundError(key);
    }
    return response.results[0];
  }

  /**
   * Get a space by ID (Effect version)
   */
  getSpaceByIdEffect(
    id: string,
  ): Effect.Effect<Space, ApiError | AuthError | NetworkError | RateLimitError | SpaceNotFoundError> {
    const baseUrl = this.baseUrl;
    const authHeader = this.authHeader;

    return Effect.tryPromise({
      try: async () => {
        const url = `${baseUrl}/wiki/api/v2/spaces/${id}`;
        const response = await fetch(url, {
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        });

        if (response.status === 404) {
          throw new SpaceNotFoundError(id);
        }
        if (response.status === 401) {
          throw new AuthError('Invalid credentials', 401);
        }
        if (response.status === 403) {
          throw new AuthError('Access denied', 403);
        }
        if (!response.ok) {
          throw new ApiError(`API error: ${response.status}`, response.status);
        }

        const data = await response.json();
        return Schema.decodeUnknownSync(SpaceSchema)(data);
      },
      catch: (error) => {
        if (error instanceof SpaceNotFoundError || error instanceof AuthError || error instanceof ApiError) {
          return error;
        }
        return new NetworkError(`Network error: ${error}`);
      },
    });
  }

  /**
   * Get a space by ID (async version)
   */
  async getSpaceById(id: string): Promise<Space> {
    return Effect.runPromise(this.getSpaceByIdEffect(id));
  }

  // ================== Pages API ==================

  /**
   * Get all pages in a space (Effect version)
   */
  getPagesInSpaceEffect(
    spaceId: string,
    limit = 25,
    cursor?: string,
  ): Effect.Effect<PagesResponse, ApiError | AuthError | NetworkError | RateLimitError> {
    let path = `/spaces/${spaceId}/pages?limit=${limit}&body-format=storage`;
    if (cursor) {
      path += `&cursor=${encodeURIComponent(cursor)}`;
    }
    return this.fetchWithRetryEffect(path, PagesResponseSchema);
  }

  /**
   * Get all pages in a space (async version)
   */
  async getPagesInSpace(spaceId: string, limit = 25, cursor?: string): Promise<PagesResponse> {
    return Effect.runPromise(this.getPagesInSpaceEffect(spaceId, limit, cursor));
  }

  /**
   * Get all pages in a space with pagination (async version)
   */
  async getAllPagesInSpace(spaceId: string): Promise<Page[]> {
    const allPages: Page[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.getPagesInSpace(spaceId, 100, cursor);
      allPages.push(...response.results);

      // Extract cursor from next link if present
      const nextLink = response._links?.next;
      if (nextLink) {
        const cursorMatch = nextLink.match(/cursor=([^&]+)/);
        cursor = cursorMatch ? decodeURIComponent(cursorMatch[1]) : undefined;
      } else {
        cursor = undefined;
      }
    } while (cursor);

    return allPages;
  }

  /**
   * Get a single page by ID (Effect version)
   */
  getPageEffect(
    pageId: string,
    includeBody = true,
  ): Effect.Effect<Page, ApiError | AuthError | NetworkError | RateLimitError> {
    const bodyFormat = includeBody ? '&body-format=storage' : '';
    return this.fetchWithRetryEffect(`/pages/${pageId}?${bodyFormat}`, PageSchema);
  }

  /**
   * Get a single page by ID (async version)
   */
  async getPage(pageId: string, includeBody = true): Promise<Page> {
    return Effect.runPromise(this.getPageEffect(pageId, includeBody));
  }

  /**
   * Get child pages of a page (Effect version)
   */
  getChildPagesEffect(
    pageId: string,
    limit = 25,
    cursor?: string,
  ): Effect.Effect<PagesResponse, ApiError | AuthError | NetworkError | RateLimitError> {
    let path = `/pages/${pageId}/children?limit=${limit}`;
    if (cursor) {
      path += `&cursor=${encodeURIComponent(cursor)}`;
    }
    return this.fetchWithRetryEffect(path, PagesResponseSchema);
  }

  /**
   * Get child pages of a page (async version)
   */
  async getChildPages(pageId: string, limit = 25, cursor?: string): Promise<PagesResponse> {
    return Effect.runPromise(this.getChildPagesEffect(pageId, limit, cursor));
  }

  // ================== Labels API ==================

  /**
   * Get labels for a page (Effect version)
   */
  getLabelsEffect(
    pageId: string,
    limit = 25,
  ): Effect.Effect<LabelsResponse, ApiError | AuthError | NetworkError | RateLimitError> {
    return this.fetchWithRetryEffect(`/pages/${pageId}/labels?limit=${limit}`, LabelsResponseSchema);
  }

  /**
   * Get labels for a page (async version)
   */
  async getLabels(pageId: string, limit = 25): Promise<LabelsResponse> {
    return Effect.runPromise(this.getLabelsEffect(pageId, limit));
  }

  /**
   * Get all labels for a page (async version)
   */
  async getAllLabels(pageId: string): Promise<Label[]> {
    const response = await this.getLabels(pageId, 100);
    return [...response.results];
  }

  // ================== Verification ==================

  /**
   * Verify connection by fetching spaces (Effect version)
   */
  verifyConnectionEffect(): Effect.Effect<boolean, ApiError | AuthError | NetworkError | RateLimitError> {
    return pipe(
      this.getSpacesEffect(1),
      Effect.map(() => true),
    );
  }

  /**
   * Verify connection by fetching spaces (async version)
   */
  async verifyConnection(): Promise<boolean> {
    await this.getSpaces(1);
    return true;
  }
}
