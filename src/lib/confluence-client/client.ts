import { Effect, pipe, Schedule, Schema } from 'effect';
import type { Config } from '../config.js';
import {
  ApiError,
  AuthError,
  type FolderNotFoundError,
  NetworkError,
  type PageNotFoundError,
  RateLimitError,
  SpaceNotFoundError,
  type VersionConflictError,
} from '../errors.js';
import {
  createFolderEffect as createFolderEffectFn,
  deleteFolderEffect as deleteFolderEffectFn,
  findFolderByTitle as findFolderByTitleFn,
  getFolderEffect as getFolderEffectFn,
  movePageEffect as movePageEffectFn,
} from './folder-operations.js';
import {
  createPageEffect as createPageEffectFn,
  deletePageEffect as deletePageEffectFn,
  setContentPropertyEffect as setContentPropertyEffectFn,
  updatePageEffect as updatePageEffectFn,
} from './page-operations.js';
import { addLabelEffect as addLabelEffectFn, removeLabelEffect as removeLabelEffectFn } from './label-operations.js';
import {
  deleteAttachmentEffect as deleteAttachmentEffectFn,
  downloadAttachment as downloadAttachmentFn,
  getAllAttachments as getAllAttachmentsFn,
  getAttachmentsEffect as getAttachmentsEffectFn,
  uploadAttachmentEffect as uploadAttachmentEffectFn,
} from './attachment-operations.js';
import { searchEffect as searchEffectFn } from './search-operations.js';
import { getAllFooterComments as getAllFooterCommentsFn } from './comment-operations.js';
import { getUserEffect as getUserEffectFn } from './user-operations.js';
import {
  CommentsResponseSchema,
  FolderSchema,
  LabelsResponseSchema,
  PageSchema,
  PagesResponseSchema,
  SpaceSchema,
  SpacesResponseSchema,
  type Attachment,
  type AttachmentsResponse,
  type Comment,
  type CommentsResponse,
  type CreateFolderRequest,
  type CreatePageRequest,
  type Folder,
  type Label,
  type LabelsResponse,
  type Page,
  type PagesResponse,
  type SearchResponse,
  type Space,
  type SpacesResponse,
  type UpdatePageRequest,
  type User,
  type VersionConflictResponse,
} from './types.js';

/**
 * Extract cursor from a next-page link returned by the Confluence API.
 * Uses the URL API to safely parse query parameters.
 */
function extractCursor(nextLink: string | undefined): string | undefined {
  if (!nextLink) return undefined;
  try {
    // nextLink may be relative (e.g. /wiki/api/v2/spaces?cursor=xxx); use a dummy base
    const url = new URL(nextLink, 'https://placeholder.invalid');
    return url.searchParams.get('cursor') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Retry configuration for rate limiting
 * Uses exponential backoff with jitter per ADR-0010
 */
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
/** Shared retry schedule for rate-limited requests */
const rateLimitRetrySchedule = Schedule.exponential(BASE_DELAY_MS).pipe(
  Schedule.jittered,
  Schedule.whileInput((error: unknown) => error instanceof RateLimitError),
  Schedule.upTo(MAX_RETRIES * BASE_DELAY_MS * 32),
);

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

  /** Make an authenticated API request with retry logic */
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

    return pipe(
      makeRequest,
      Effect.flatMap((data) =>
        Schema.decodeUnknown(schema)(data).pipe(Effect.mapError((e) => new ApiError(`Invalid response: ${e}`, 500))),
      ),
      Effect.retry(rateLimitRetrySchedule),
    );
  }

  /** Async wrapper for fetch with retry */
  private async fetchWithRetry<T>(path: string, schema: Schema.Schema<T>, options?: RequestInit): Promise<T> {
    return Effect.runPromise(this.fetchWithRetryEffect(path, schema, options));
  }

  // ================== Spaces API ==================

  /** Get all spaces (Effect version) */
  getSpacesEffect(limit = 25): Effect.Effect<SpacesResponse, ApiError | AuthError | NetworkError | RateLimitError> {
    return this.fetchWithRetryEffect(`/spaces?limit=${limit}`, SpacesResponseSchema);
  }

  /** Get all spaces (async version) */
  async getSpaces(limit = 25): Promise<SpacesResponse> {
    return this.fetchWithRetry(`/spaces?limit=${limit}`, SpacesResponseSchema);
  }

  /** Get all spaces with pagination (async version) */
  async getAllSpaces(): Promise<Space[]> {
    const allSpaces: Space[] = [];
    let cursor: string | undefined;
    do {
      let path = '/spaces?limit=100';
      if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
      const response = await this.fetchWithRetry(path, SpacesResponseSchema);
      allSpaces.push(...response.results);
      cursor = extractCursor(response._links?.next);
    } while (cursor);
    return allSpaces;
  }

  /** Get a space by key (Effect version) */
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

  /** Get a space by key (async version) */
  async getSpaceByKey(key: string): Promise<Space> {
    const response = await this.fetchWithRetry(`/spaces?keys=${key}&limit=1`, SpacesResponseSchema);
    if (response.results.length === 0) {
      throw new SpaceNotFoundError(key);
    }
    return response.results[0];
  }

  /** Get a space by ID (Effect version) */
  getSpaceByIdEffect(
    id: string,
  ): Effect.Effect<Space, ApiError | AuthError | NetworkError | RateLimitError | SpaceNotFoundError> {
    const baseUrl = this.baseUrl;
    const authHeader = this.authHeader;
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
        if (error instanceof SpaceNotFoundError || error instanceof AuthError || error instanceof ApiError)
          return error;
        return new NetworkError(`Network error: ${error}`);
      },
    });
  }

  /** Get a space by ID (async version) */
  async getSpaceById(id: string): Promise<Space> {
    return Effect.runPromise(this.getSpaceByIdEffect(id));
  }

  // ================== Pages API ==================

  /**
   * Get all pages in a space (Effect version)
   * Note: Returns pages with all statuses. Use getAllPagesInSpace for filtered results (current only).
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
   * Note: Returns pages with all statuses. Use getAllPagesInSpace for filtered results (current only).
   */
  async getPagesInSpace(spaceId: string, limit = 25, cursor?: string): Promise<PagesResponse> {
    return Effect.runPromise(this.getPagesInSpaceEffect(spaceId, limit, cursor));
  }

  /**
   * Get all pages in a space with pagination (async version)
   * Only returns pages with status='current' (excludes archived and trashed pages)
   */
  async getAllPagesInSpace(spaceId: string): Promise<Page[]> {
    const allPages: Page[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.getPagesInSpace(spaceId, 100, cursor);
      // Filter out archived and trashed pages - only include current pages
      allPages.push(...response.results.filter((page) => page.status === 'current'));

      cursor = extractCursor(response._links?.next);
    } while (cursor);

    return allPages;
  }

  /** Get a single page by ID (Effect version) */
  getPageEffect(
    pageId: string,
    includeBody = true,
  ): Effect.Effect<Page, ApiError | AuthError | NetworkError | RateLimitError> {
    const bodyFormat = includeBody ? '&body-format=storage' : '';
    return this.fetchWithRetryEffect(`/pages/${pageId}?${bodyFormat}`, PageSchema);
  }

  /** Get a single page by ID (async version) */
  async getPage(pageId: string, includeBody = true): Promise<Page> {
    return Effect.runPromise(this.getPageEffect(pageId, includeBody));
  }

  /**
   * Update a page (Effect version)
   * Uses PUT /wiki/api/v2/pages/{id} endpoint
   */
  updatePageEffect(
    request: UpdatePageRequest,
  ): Effect.Effect<
    Page,
    ApiError | AuthError | NetworkError | RateLimitError | PageNotFoundError | VersionConflictError
  > {
    return updatePageEffectFn(this.baseUrl, this.authHeader, request);
  }

  /** Update a page (async version) */
  async updatePage(request: UpdatePageRequest): Promise<Page> {
    return Effect.runPromise(this.updatePageEffect(request));
  }

  /** Create a new page (Effect version) */
  createPageEffect(
    request: CreatePageRequest,
  ): Effect.Effect<Page, ApiError | AuthError | NetworkError | RateLimitError> {
    return createPageEffectFn(this.baseUrl, this.authHeader, request);
  }

  /** Create a new page (async version) */
  async createPage(request: CreatePageRequest): Promise<Page> {
    return Effect.runPromise(this.createPageEffect(request));
  }

  /** Set a content property on a page (Effect version) */
  setContentPropertyEffect(
    pageId: string,
    key: string,
    value: unknown,
  ): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
    return setContentPropertyEffectFn(this.baseUrl, this.authHeader, pageId, key, value);
  }

  /** Set a content property on a page (async version) */
  async setContentProperty(pageId: string, key: string, value: unknown): Promise<void> {
    return Effect.runPromise(this.setContentPropertyEffect(pageId, key, value));
  }

  /** Set editor version to v2 for a page (enables new editor) */
  async setEditorV2(pageId: string): Promise<void> {
    return this.setContentProperty(pageId, 'editor', 'v2');
  }

  /** Get child pages of a page (Effect version) */
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

  /** Get child pages of a page (async version) */
  async getChildPages(pageId: string, limit = 25, cursor?: string): Promise<PagesResponse> {
    return Effect.runPromise(this.getChildPagesEffect(pageId, limit, cursor));
  }

  // ================== Labels API ==================

  /** Get labels for a page (Effect version) */
  getLabelsEffect(
    pageId: string,
    limit = 25,
  ): Effect.Effect<LabelsResponse, ApiError | AuthError | NetworkError | RateLimitError> {
    return this.fetchWithRetryEffect(`/pages/${pageId}/labels?limit=${limit}`, LabelsResponseSchema);
  }

  /** Get labels for a page (async version) */
  async getLabels(pageId: string, limit = 25): Promise<LabelsResponse> {
    return Effect.runPromise(this.getLabelsEffect(pageId, limit));
  }

  /** Get all labels for a page (async version) */
  async getAllLabels(pageId: string): Promise<Label[]> {
    const response = await this.getLabels(pageId, 100);
    return [...response.results];
  }

  // ================== Users API ==================

  /**
   * Get user information by account ID (Effect version)
   * Uses v1 API as v2 does not have a user endpoint
   */
  getUserEffect(accountId: string): Effect.Effect<User, ApiError | AuthError | NetworkError | RateLimitError> {
    return getUserEffectFn(this.baseUrl, this.authHeader, accountId);
  }

  /** Get user information by account ID (async version) */
  async getUser(accountId: string): Promise<User> {
    return Effect.runPromise(this.getUserEffect(accountId));
  }

  // ================== Folders API ==================

  /**
   * Get a folder by ID (Effect version)
   * Uses v2 /folders/{id} endpoint per ADR-0018
   */
  getFolderEffect(
    folderId: string,
  ): Effect.Effect<Folder, ApiError | AuthError | NetworkError | RateLimitError | FolderNotFoundError> {
    return getFolderEffectFn(this.baseUrl, this.authHeader, folderId);
  }

  /** Get a folder by ID (async version) */
  async getFolder(folderId: string): Promise<Folder> {
    return Effect.runPromise(this.getFolderEffect(folderId));
  }

  /**
   * Discover and fetch all folders referenced by pages
   * Finds pages with parentIds that don't match any page and fetches those as folders
   */
  async discoverFolders(pages: Page[]): Promise<Folder[]> {
    const pageIds = new Set(pages.map((p) => p.id));
    const potentialFolderIds = new Set<string>();

    // Find parentIds that aren't pages
    for (const page of pages) {
      if (page.parentId && !pageIds.has(page.parentId)) {
        potentialFolderIds.add(page.parentId);
      }
    }

    // Fetch each potential folder
    const folders: Folder[] = [];
    for (const folderId of potentialFolderIds) {
      try {
        const folder = await this.getFolder(folderId);
        folders.push(folder);

        // Check if this folder's parent is also a folder we need
        if (folder.parentId && !pageIds.has(folder.parentId) && !potentialFolderIds.has(folder.parentId)) {
          potentialFolderIds.add(folder.parentId);
        }
      } catch {
        // Silently skip if folder fetch fails (might be deleted)
      }
    }

    return folders;
  }

  /** Get all pages and folders in a space */
  async getAllContentInSpace(spaceId: string): Promise<{ pages: Page[]; folders: Folder[] }> {
    const pages = await this.getAllPagesInSpace(spaceId);
    const folders = await this.discoverFolders(pages);
    return { pages, folders };
  }

  /**
   * Create a new folder (Effect version)
   * Uses POST /wiki/api/v2/folders endpoint
   */
  createFolderEffect(
    request: CreateFolderRequest,
  ): Effect.Effect<Folder, ApiError | AuthError | NetworkError | RateLimitError> {
    return createFolderEffectFn(this.baseUrl, this.authHeader, request);
  }

  /** Create a new folder (async version) */
  async createFolder(request: CreateFolderRequest): Promise<Folder> {
    return Effect.runPromise(this.createFolderEffect(request));
  }

  /**
   * Delete a folder by ID (Effect version)
   */
  deleteFolderEffect(
    folderId: string,
  ): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError | FolderNotFoundError> {
    return deleteFolderEffectFn(this.baseUrl, this.authHeader, folderId);
  }

  /** Delete a folder by ID (async version) */
  async deleteFolder(folderId: string): Promise<void> {
    return Effect.runPromise(this.deleteFolderEffect(folderId));
  }

  /**
   * Find a folder by title in a space
   * Uses v1 CQL search API to find folders by title
   * @param spaceKey - Space key to search in
   * @param title - Folder title to find
   * @param parentId - Optional parent folder ID (for nested folders)
   * @returns Folder if found, null otherwise
   */
  async findFolderByTitle(spaceKey: string, title: string, parentId?: string): Promise<Folder | null> {
    return findFolderByTitleFn(this.baseUrl, this.authHeader, spaceKey, title, parentId);
  }

  /**
   * Move a page to a new parent (Effect version)
   * Uses v1 API: PUT /wiki/rest/api/content/{id}/move/{position}/{targetId}
   */
  movePageEffect(
    pageId: string,
    targetId: string,
    position: 'append' | 'prepend' = 'append',
  ): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError | PageNotFoundError> {
    return movePageEffectFn(this.baseUrl, this.authHeader, pageId, targetId, position);
  }

  /** Move a page to a new parent (async version) */
  async movePage(pageId: string, targetId: string, position: 'append' | 'prepend' = 'append'): Promise<void> {
    return Effect.runPromise(this.movePageEffect(pageId, targetId, position));
  }

  // ================== Search API ==================

  /** Search pages using CQL (Effect version) */
  searchEffect(
    cql: string,
    limit = 10,
    start = 0,
  ): Effect.Effect<SearchResponse, ApiError | AuthError | NetworkError | RateLimitError> {
    return searchEffectFn(this.baseUrl, this.authHeader, cql, limit, start);
  }

  /** Search pages using CQL (async version) */
  async search(cql: string, limit = 10, start = 0): Promise<SearchResponse> {
    return Effect.runPromise(this.searchEffect(cql, limit, start));
  }

  // ================== Comments API ==================

  /** Get footer comments for a page (Effect version) */
  getFooterCommentsEffect(
    pageId: string,
  ): Effect.Effect<CommentsResponse, ApiError | AuthError | NetworkError | RateLimitError> {
    return this.fetchWithRetryEffect(`/pages/${pageId}/footer-comments?body-format=storage`, CommentsResponseSchema);
  }

  /** Get footer comments for a page (async version) */
  async getFooterComments(pageId: string): Promise<CommentsResponse> {
    return Effect.runPromise(this.getFooterCommentsEffect(pageId));
  }

  /** Get all footer comments for a page with pagination (async version) */
  async getAllFooterComments(pageId: string): Promise<Comment[]> {
    return getAllFooterCommentsFn(this.baseUrl, this.authHeader, pageId);
  }

  // ================== Attachments API ==================

  /** Get attachments for a page (Effect version) */
  getAttachmentsEffect(
    pageId: string,
  ): Effect.Effect<AttachmentsResponse, ApiError | AuthError | NetworkError | RateLimitError> {
    return getAttachmentsEffectFn(this.baseUrl, this.authHeader, pageId);
  }

  /** Get attachments for a page (async version) */
  async getAttachments(pageId: string): Promise<AttachmentsResponse> {
    return Effect.runPromise(this.getAttachmentsEffect(pageId));
  }

  /** Get all attachments for a page with pagination (async version) */
  async getAllAttachments(pageId: string): Promise<Attachment[]> {
    return getAllAttachmentsFn(this.baseUrl, this.authHeader, pageId);
  }

  /** Upload an attachment to a page (Effect version) */
  uploadAttachmentEffect(
    pageId: string,
    filename: string,
    data: Buffer,
    mimeType: string,
  ): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
    return uploadAttachmentEffectFn(this.baseUrl, this.authHeader, pageId, filename, data, mimeType);
  }

  /** Upload an attachment to a page (async version) */
  async uploadAttachment(pageId: string, filename: string, data: Buffer, mimeType: string): Promise<void> {
    return Effect.runPromise(this.uploadAttachmentEffect(pageId, filename, data, mimeType));
  }

  /** Download an attachment by its download link (async version) */
  async downloadAttachment(downloadLink: string): Promise<Buffer> {
    return downloadAttachmentFn(this.baseUrl, this.authHeader, downloadLink);
  }

  /** Delete an attachment (Effect version) */
  deleteAttachmentEffect(
    attachmentId: string,
  ): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
    return deleteAttachmentEffectFn(this.baseUrl, this.authHeader, attachmentId);
  }

  /** Delete an attachment (async version) */
  async deleteAttachment(attachmentId: string): Promise<void> {
    return Effect.runPromise(this.deleteAttachmentEffect(attachmentId));
  }

  // ================== Label Mutations ==================

  /** Add a label to a page (Effect version) */
  addLabelEffect(
    pageId: string,
    labelName: string,
  ): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
    return addLabelEffectFn(this.baseUrl, this.authHeader, pageId, labelName);
  }

  /** Add a label to a page (async version) */
  async addLabel(pageId: string, labelName: string): Promise<void> {
    return Effect.runPromise(this.addLabelEffect(pageId, labelName));
  }

  /** Remove a label from a page (Effect version) */
  removeLabelEffect(
    pageId: string,
    labelName: string,
  ): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError> {
    return removeLabelEffectFn(this.baseUrl, this.authHeader, pageId, labelName);
  }

  /** Remove a label from a page (async version) */
  async removeLabel(pageId: string, labelName: string): Promise<void> {
    return Effect.runPromise(this.removeLabelEffect(pageId, labelName));
  }

  // ================== Page Deletion ==================

  /** Delete a page (Effect version) */
  deletePageEffect(
    pageId: string,
  ): Effect.Effect<void, ApiError | AuthError | NetworkError | RateLimitError | PageNotFoundError> {
    return deletePageEffectFn(this.baseUrl, this.authHeader, pageId);
  }

  /** Delete a page (async version) */
  async deletePage(pageId: string): Promise<void> {
    return Effect.runPromise(this.deletePageEffect(pageId));
  }

  // ================== Verification ==================

  /** Verify connection by fetching spaces (Effect version) */
  verifyConnectionEffect(): Effect.Effect<boolean, ApiError | AuthError | NetworkError | RateLimitError> {
    return pipe(
      this.getSpacesEffect(1),
      Effect.map(() => true),
    );
  }

  /** Verify connection by fetching spaces (async version) */
  async verifyConnection(): Promise<boolean> {
    await this.getSpaces(1);
    return true;
  }
}
