/**
 * Search types for Meilisearch integration
 */

/**
 * Document structure indexed in Meilisearch
 */
export interface SearchDocument {
  /** Primary key - page_id from frontmatter */
  id: string;

  /** Searchable fields */
  title: string;
  content: string;

  /** Filterable fields */
  space_key: string;
  labels: string[];
  author_email: string | null;
  last_modifier_email: string | null;

  /** Sortable fields (Unix timestamps) */
  created_at: number | null;
  updated_at: number | null;

  /** Display fields */
  local_path: string;
  url: string | null;
  parent_title: string | null;
}

/**
 * Search query options
 */
export interface SearchOptions {
  /** Filter by labels */
  labels?: string[];
  /** Filter by author email */
  author?: string;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Single search result with highlighting
 */
export interface SearchResult {
  /** The matched document */
  document: SearchDocument;
  /** Highlighted snippet of content */
  snippet: string;
  /** Rank/position in results */
  rank: number;
}

/**
 * Search response
 */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalHits: number;
  processingTimeMs: number;
}

/**
 * Index status information
 */
export interface IndexStatus {
  connected: boolean;
  meilisearchUrl: string;
  indexName: string | null;
  documentCount: number | null;
  error?: string;
}

/**
 * Default Meilisearch configuration
 */
export const DEFAULT_MEILISEARCH_URL = 'http://localhost:7700';

/**
 * Generate index name from space key
 */
export function getIndexName(spaceKey: string): string {
  return `cn-${spaceKey.toLowerCase()}`;
}
