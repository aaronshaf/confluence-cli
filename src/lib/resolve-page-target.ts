/**
 * Resolve a page target argument to a page ID.
 *
 * Accepts:
 * - A path ending in .md or containing /: reads frontmatter to extract page_id
 * - A numeric string: used directly as the page ID
 * - Otherwise: throws with a usage hint
 */

import { readFileSync } from 'node:fs';
import { extractPageId } from './markdown/frontmatter.js';

export function resolvePageTarget(target: string): string {
  if (target.endsWith('.md') || target.includes('/')) {
    let content: string;
    try {
      content = readFileSync(target, 'utf-8');
    } catch {
      throw new Error(`File not found: ${target}`);
    }
    const pageId = extractPageId(content);
    if (!pageId) {
      throw new Error(`No page_id found in frontmatter of ${target}`);
    }
    return pageId;
  }

  if (/^\d+$/.test(target)) {
    return target;
  }

  throw new Error(`Invalid page target: "${target}". Provide a page ID (numeric) or a path to a .md file.`);
}
