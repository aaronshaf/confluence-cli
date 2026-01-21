import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseMarkdown, serializeMarkdown } from './frontmatter.js';

/**
 * Prefix for relative paths in markdown links
 */
const RELATIVE_PREFIX = './';

/**
 * Directories to exclude when scanning for markdown files
 */
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', '.cache'];

/**
 * Result of updating references in a file
 */
export interface ReferenceUpdateResult {
  filePath: string;
  updatedCount: number;
}

/**
 * Statistics for file scanning operations
 */
interface ScanStats {
  failedFiles: number;
  failedDirs: number;
}

/**
 * Find all markdown files in a directory recursively
 * Excludes node_modules, .git, and other common ignore patterns
 *
 * @param directory - Root directory to scan
 * @param excludeOldFile - Optional file path to exclude
 * @param excludeNewFile - Optional file path to exclude
 * @param stats - Optional stats object to track errors
 * @returns Array of absolute file paths
 */
function findMarkdownFiles(
  directory: string,
  excludeOldFile?: string,
  excludeNewFile?: string,
  stats?: ScanStats,
): string[] {
  const results: string[] = [];
  const excludeDirs = EXCLUDE_DIRS;

  function scan(dir: string): void {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);

        // Skip if this is one of the excluded files
        if ((excludeOldFile && fullPath === excludeOldFile) || (excludeNewFile && fullPath === excludeNewFile)) {
          continue;
        }

        try {
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            // Skip excluded directories
            if (!excludeDirs.includes(entry)) {
              scan(fullPath);
            }
          } else if (stat.isFile() && entry.endsWith('.md')) {
            results.push(fullPath);
          }
        } catch (error) {
          // Track files/dirs we can't access (likely permission issues)
          if (stats) stats.failedFiles++;
          if (process.env.DEBUG) {
            console.error(`Failed to stat ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      // Track directories we can't read (likely permission issues)
      if (stats) stats.failedDirs++;
      if (process.env.DEBUG) {
        console.error(`Failed to read directory ${dir}:`, error);
      }
    }
  }

  scan(directory);
  return results;
}

/**
 * Update references in a markdown file from oldPath to newPath
 * Returns the number of references updated, or -1 if processing failed
 */
function updateReferencesInFile(
  filePath: string,
  oldRelativePath: string,
  newRelativePath: string,
  spaceRoot: string,
): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const { frontmatter, content: markdown } = parseMarkdown(content);

    // Calculate what the old path would look like from this file's perspective
    const fileDir = dirname(filePath);
    const oldAbsolutePath = join(spaceRoot, oldRelativePath);
    const newAbsolutePath = join(spaceRoot, newRelativePath);

    // Calculate relative paths from this file to the old and new locations
    const oldLinkFromFile = relative(fileDir, oldAbsolutePath);
    const newLinkFromFile = relative(fileDir, newAbsolutePath);

    // Links in markdown may or may not have ./ prefix, so we need to check both forms
    // Paths starting with . (including ./ and ../) are kept as-is; others get ./ prefix added
    const oldLinkWithPrefix = oldLinkFromFile.startsWith('.')
      ? oldLinkFromFile
      : `${RELATIVE_PREFIX}${oldLinkFromFile}`;
    const oldLinkWithoutPrefix = oldLinkFromFile.startsWith('./') ? oldLinkFromFile.slice(2) : oldLinkFromFile;
    const newLinkWithoutPrefix = newLinkFromFile.startsWith('./') ? newLinkFromFile.slice(2) : newLinkFromFile;

    let updatedMarkdown = markdown;
    let updateCount = 0;

    // Try matching with ./ prefix first
    const patternWithPrefix = createMarkdownLinkPattern(oldLinkWithPrefix);
    const matchesWithPrefix = markdown.match(patternWithPrefix);
    if (matchesWithPrefix) {
      updateCount += matchesWithPrefix.length;
      updatedMarkdown = updatedMarkdown.replace(patternWithPrefix, (_match, linkText) => {
        return `[${linkText}](${oldLinkWithPrefix.startsWith('./') ? `${RELATIVE_PREFIX}${newLinkWithoutPrefix}` : newLinkWithoutPrefix})`;
      });
    }

    // Also try matching without ./ prefix (common in markdown)
    if (!oldLinkFromFile.startsWith('.')) {
      const patternWithoutPrefix = createMarkdownLinkPattern(oldLinkWithoutPrefix);
      const matchesWithoutPrefix = updatedMarkdown.match(patternWithoutPrefix);
      if (matchesWithoutPrefix) {
        updateCount += matchesWithoutPrefix.length;
        updatedMarkdown = updatedMarkdown.replace(patternWithoutPrefix, (_match, linkText) => {
          return `[${linkText}](${newLinkWithoutPrefix})`;
        });
      }
    }

    // Write updated content if any changes were made
    if (updateCount > 0) {
      const updatedContent = serializeMarkdown(frontmatter, updatedMarkdown);
      writeFileSync(filePath, updatedContent, 'utf-8');
    }

    return updateCount;
  } catch (error) {
    // Track files that can't be processed (likely permission issues or malformed frontmatter)
    if (process.env.DEBUG) {
      console.error(`Failed to update references in ${filePath}:`, error);
    }
    return -1; // Signal processing failure
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a regex pattern to match markdown links with a specific href
 * Handles complex link text including nested brackets and parentheses
 *
 * Pattern explanation:
 * - \[ - opening bracket
 * - ([^\[\]]+(?:\[[^\]]*\][^\[\]]*)*) - captures link text including nested brackets:
 *   - [^\[\]]+ - one or more non-bracket characters
 *   - (?:\[[^\]]*\][^\[\]]*)* - zero or more groups of [nested] followed by non-brackets
 * - \] - closing bracket
 * - \(${escapedLink}\) - the exact link path in parentheses
 *
 * This handles cases like [text], [text [nested]], [text (with) parens], etc.
 *
 * Known limitations (not currently supported):
 * - Links with titles: [text](path.md "title")
 * - Reference-style links: [text][ref] with [ref]: path.md
 *
 * @param link - The link href to match (will be escaped)
 * @returns RegExp pattern that matches markdown links with the given href
 */
function createMarkdownLinkPattern(link: string): RegExp {
  const escapedLink = escapeRegex(link);
  return new RegExp(`\\[([^\\[\\]]+(?:\\[[^\\]]*\\][^\\[\\]]*)*)\\]\\(${escapedLink}\\)`, 'g');
}

/**
 * Update all references to a renamed file across the entire space
 * Per ADR-0022: When files are renamed, update all markdown links pointing to them
 *
 * Performance note: This scans all markdown files in the space directory.
 * For large repositories, consider implementing an index of links or limiting
 * the scan to common parent directories.
 *
 * @param spaceRoot - Absolute path to space root directory
 * @param oldPath - Old path relative to space root
 * @param newPath - New path relative to space root
 * @returns Array of files that were updated with the number of references changed
 */
export function updateReferencesAfterRename(
  spaceRoot: string,
  oldPath: string,
  newPath: string,
): ReferenceUpdateResult[] {
  const results: ReferenceUpdateResult[] = [];
  const scanStats: ScanStats = { failedFiles: 0, failedDirs: 0 };
  let failedProcessing = 0;

  // Find all markdown files in the space (except the renamed file at both old and new locations)
  const oldFullPath = join(spaceRoot, oldPath);
  const newFullPath = join(spaceRoot, newPath);
  const markdownFiles = findMarkdownFiles(spaceRoot, oldFullPath, newFullPath, scanStats);

  // Update references in each file
  for (const filePath of markdownFiles) {
    const updatedCount = updateReferencesInFile(filePath, oldPath, newPath, spaceRoot);

    if (updatedCount > 0) {
      results.push({
        filePath: relative(spaceRoot, filePath),
        updatedCount,
      });
    } else if (updatedCount === -1) {
      failedProcessing++;
    }
  }

  // Log summary of errors if any occurred
  const totalErrors = scanStats.failedFiles + scanStats.failedDirs + failedProcessing;
  if (totalErrors > 0 && process.env.DEBUG) {
    console.warn(
      `Reference update encountered ${totalErrors} errors: ` +
        `${scanStats.failedFiles} files, ${scanStats.failedDirs} directories (scan), ` +
        `${failedProcessing} files (processing)`,
    );
  }

  return results;
}
