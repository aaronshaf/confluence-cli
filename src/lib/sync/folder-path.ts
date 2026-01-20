/**
 * Path and folder utilities for sync operations
 * Per ADR-0023: Folder push workflow support
 */

import { resolve } from 'node:path';
import type { ContentItem, Folder } from '../confluence-client/index.js';
import { SyncError } from '../errors.js';
import { RESERVED_FILENAMES } from '../file-scanner.js';
import { slugify } from '../markdown/index.js';

/**
 * Validate that a path stays within a base directory (prevents path traversal)
 * @throws SyncError if path escapes the base directory
 */
export function assertPathWithinDirectory(baseDir: string, targetPath: string): void {
  const resolvedBase = resolve(baseDir);
  const resolvedTarget = resolve(baseDir, targetPath);
  if (!resolvedTarget.startsWith(`${resolvedBase}/`) && resolvedTarget !== resolvedBase) {
    throw new SyncError(`Path traversal detected: "${targetPath}" escapes base directory`);
  }
}

/** Check if page title would generate a reserved filename (CLAUDE.md, AGENTS.md) */
export const wouldGenerateReservedFilename = (title: string): boolean => RESERVED_FILENAMES.has(`${slugify(title)}.md`);

/**
 * Generate the local path for a folder based on hierarchy
 * Per ADR-0023: Folder push workflow support
 */
export function generateFolderPath(folder: Folder, contentMap: Map<string, ContentItem>): string {
  const parentChain: string[] = [];
  let currentId: string | undefined | null = folder.parentId;

  // Track visited IDs to prevent infinite loops from circular references
  const visited = new Set<string>();

  // Build parent chain
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const parent = contentMap.get(currentId);
    if (parent) {
      parentChain.unshift(slugify(parent.title));
      currentId = parent.parentId;
    } else {
      break;
    }
  }

  // Warn if we detected a circular reference (loop exited because of visited check)
  if (currentId && visited.has(currentId)) {
    console.warn(
      `Warning: Circular reference detected in folder hierarchy for "${folder.title}" (id: ${folder.id}). Path may be truncated.`,
    );
  }

  // Add this folder's slug
  parentChain.push(slugify(folder.title));

  return parentChain.join('/');
}
