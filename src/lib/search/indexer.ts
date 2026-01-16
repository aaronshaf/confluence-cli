/**
 * Indexer for scanning markdown files and creating search documents
 */

import { type Dirent, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseMarkdown, type PageFrontmatter } from '../markdown/frontmatter.js';
import type { SearchDocument } from './types.js';

/**
 * Directories to exclude from scanning
 * Note: Hidden directories (starting with '.') are already excluded in walkDirectory
 */
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '__pycache__']);

/**
 * Scan a directory recursively for markdown files
 */
function* walkDirectory(dir: string, baseDir: string): Generator<string> {
  let entries: Dirent<string>[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // Skip directories we can't read (permission errors, etc.)
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip excluded directories and hidden directories
      if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      yield* walkDirectory(fullPath, baseDir);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield fullPath;
    }
  }
}

/**
 * Parse ISO date string to Unix timestamp
 */
function parseTimestamp(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
}

/**
 * Convert a markdown file to a search document
 */
function fileToSearchDocument(filePath: string, baseDir: string): SearchDocument | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const { frontmatter, content: markdownContent } = parseMarkdown(content);

    // Skip files without page_id (not synced from Confluence)
    if (!frontmatter.page_id) {
      return null;
    }

    const localPath = relative(baseDir, filePath);

    return {
      id: frontmatter.page_id,
      title: frontmatter.title || localPath,
      content: markdownContent.trim(),
      space_key: frontmatter.space_key || '',
      labels: frontmatter.labels || [],
      author_email: frontmatter.author_email || null,
      last_modifier_email: frontmatter.last_modifier_email || null,
      created_at: parseTimestamp(frontmatter.created_at),
      updated_at: parseTimestamp(frontmatter.updated_at),
      local_path: localPath,
      url: frontmatter.url || null,
      parent_title: frontmatter.parent_title || null,
    };
  } catch {
    // Skip files that can't be parsed
    return null;
  }
}

/**
 * Indexing result
 */
export interface IndexingResult {
  documents: SearchDocument[];
  scannedFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  errors: string[];
}

/**
 * Scan directory and create search documents from all markdown files
 */
export function scanDirectory(directory: string): IndexingResult {
  const result: IndexingResult = {
    documents: [],
    scannedFiles: 0,
    indexedFiles: 0,
    skippedFiles: 0,
    errors: [],
  };

  try {
    // Check if directory exists
    const stat = statSync(directory);
    if (!stat.isDirectory()) {
      result.errors.push(`${directory} is not a directory`);
      return result;
    }
  } catch {
    result.errors.push(`Directory not found: ${directory}`);
    return result;
  }

  for (const filePath of walkDirectory(directory, directory)) {
    result.scannedFiles++;

    try {
      const doc = fileToSearchDocument(filePath, directory);
      if (doc) {
        result.documents.push(doc);
        result.indexedFiles++;
      } else {
        result.skippedFiles++;
      }
    } catch (error) {
      result.errors.push(`Error processing ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.skippedFiles++;
    }
  }

  return result;
}

/**
 * Create a search document from frontmatter (for testing or direct creation)
 */
export function createSearchDocument(
  frontmatter: Partial<PageFrontmatter>,
  content: string,
  localPath: string,
): SearchDocument | null {
  if (!frontmatter.page_id) {
    return null;
  }

  return {
    id: frontmatter.page_id,
    title: frontmatter.title || localPath,
    content: content.trim(),
    space_key: frontmatter.space_key || '',
    labels: frontmatter.labels || [],
    author_email: frontmatter.author_email || null,
    last_modifier_email: frontmatter.last_modifier_email || null,
    created_at: parseTimestamp(frontmatter.created_at),
    updated_at: parseTimestamp(frontmatter.updated_at),
    local_path: localPath,
    url: frontmatter.url || null,
    parent_title: frontmatter.parent_title || null,
  };
}
