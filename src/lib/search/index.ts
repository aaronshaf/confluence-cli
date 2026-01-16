/**
 * Search module facade
 * Re-exports all search functionality
 */

export { SearchClient } from './client.js';
export { scanDirectory, createSearchDocument, type IndexingResult } from './indexer.js';
export {
  type SearchDocument,
  type SearchOptions,
  type SearchResult,
  type SearchResponse,
  type IndexStatus,
  DEFAULT_MEILISEARCH_URL,
  getIndexName,
} from './types.js';
