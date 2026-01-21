import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Schema } from 'effect';

/**
 * Legacy page sync info schema for migration detection
 * Per ADR-0024: This format is deprecated in favor of frontmatter as source of truth
 * @deprecated Use page mappings (pageId -> localPath) instead
 */
const LegacyPageSyncInfoSchema = Schema.Struct({
  pageId: Schema.String,
  version: Schema.Number,
  lastModified: Schema.optional(Schema.String),
  localPath: Schema.String,
  title: Schema.optional(Schema.String),
});

/**
 * Legacy page sync information - kept for migration support
 * Per ADR-0024: Version, title, lastModified now read from frontmatter
 * @deprecated Use page mappings and read frontmatter for full info
 */
export type PageSyncInfo = Schema.Schema.Type<typeof LegacyPageSyncInfoSchema>;

/**
 * Folder sync info schema for tracking created folders
 * Per ADR-0023: Folder push workflow support
 */
const FolderSyncInfoSchema = Schema.Struct({
  folderId: Schema.String,
  title: Schema.String,
  parentId: Schema.optional(Schema.String),
  localPath: Schema.String, // Directory path, e.g., "docs/api"
});

/**
 * Search configuration schema for Meilisearch integration
 */
const SearchConfigSchema = Schema.Struct({
  meilisearchUrl: Schema.optional(Schema.String),
  apiKey: Schema.optional(Schema.NullOr(Schema.String)),
  indexName: Schema.optional(Schema.String),
});

export type SearchConfig = Schema.Schema.Type<typeof SearchConfigSchema>;

/**
 * Folder sync information stored in .confluence.json
 * Per ADR-0023: Folder push workflow support
 */
export type FolderSyncInfo = Schema.Schema.Type<typeof FolderSyncInfoSchema>;

/**
 * Space configuration schema
 */
const SpaceConfigSchema = Schema.Struct({
  spaceKey: Schema.String,
  spaceId: Schema.String,
  spaceName: Schema.String,
  lastSync: Schema.optional(Schema.String),
  syncState: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
});

export type SpaceConfig = Schema.Schema.Type<typeof SpaceConfigSchema>;

/**
 * Full space configuration schema including sync state
 * Per ADR-0024: pages is now a simple mapping (pageId -> localPath)
 * Version, title, and timestamps are read from frontmatter when needed
 */
const SpaceConfigWithStateSchema = Schema.Struct({
  spaceKey: Schema.String,
  spaceId: Schema.String,
  spaceName: Schema.String,
  lastSync: Schema.optional(Schema.String),
  syncState: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
  pages: Schema.Record({ key: Schema.String, value: Schema.String }), // pageId -> localPath
  folders: Schema.optional(Schema.Record({ key: Schema.String, value: FolderSyncInfoSchema })),
  search: Schema.optional(SearchConfigSchema),
});

/**
 * Full space configuration including sync state
 * Per ADR-0024: pages is now Record<string, string> (pageId -> localPath)
 */
export type SpaceConfigWithState = Schema.Schema.Type<typeof SpaceConfigWithStateSchema>;

/**
 * Detect if pages object is in legacy format (object values vs string values)
 */
function isLegacyFormat(pages: Record<string, unknown>): boolean {
  const firstValue = Object.values(pages)[0];
  return typeof firstValue === 'object' && firstValue !== null;
}

/**
 * Migrate legacy pages format to new format
 * Legacy: { pageId: { pageId, version, localPath, ... } }
 * New: { pageId: localPath }
 */
function migrateLegacyPages(pages: Record<string, unknown>): Record<string, string> {
  const migrated: Record<string, string> = {};
  for (const [id, page] of Object.entries(pages)) {
    if (typeof page === 'object' && page !== null && 'localPath' in page) {
      migrated[id] = (page as { localPath: string }).localPath;
    }
  }
  return migrated;
}

const CONFIG_FILENAME = '.confluence.json';

/**
 * Read space configuration from the current directory
 * Validates the config against the schema for security
 * Per ADR-0024: Auto-migrates legacy format to new format
 */
export function readSpaceConfig(directory: string): SpaceConfigWithState | null {
  const configPath = join(directory, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Check for legacy format and migrate if needed (ADR-0024)
    if (parsed.pages && Object.keys(parsed.pages).length > 0 && isLegacyFormat(parsed.pages)) {
      const migratedPages = migrateLegacyPages(parsed.pages);
      const migrated = { ...parsed, pages: migratedPages };

      // Write migrated config back to disk
      writeFileSync(configPath, JSON.stringify(migrated, null, 2), 'utf-8');

      // Validate and return migrated config
      return Schema.decodeUnknownSync(SpaceConfigWithStateSchema)(migrated);
    }

    // Validate against schema to prevent malformed config attacks
    return Schema.decodeUnknownSync(SpaceConfigWithStateSchema)(parsed);
  } catch {
    // Invalid config file - return null to indicate no valid config
    return null;
  }
}

/**
 * Write space configuration to the current directory
 */
export function writeSpaceConfig(directory: string, config: SpaceConfigWithState): void {
  const configPath = join(directory, CONFIG_FILENAME);
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Check if a directory has space configuration
 */
export function hasSpaceConfig(directory: string): boolean {
  return existsSync(join(directory, CONFIG_FILENAME));
}

/**
 * Create initial space configuration
 */
export function createSpaceConfig(spaceKey: string, spaceId: string, spaceName: string): SpaceConfigWithState {
  return {
    spaceKey,
    spaceId,
    spaceName,
    pages: {},
  };
}

/**
 * Update the last sync time in the configuration
 */
export function updateLastSync(config: SpaceConfigWithState): SpaceConfigWithState {
  return {
    ...config,
    lastSync: new Date().toISOString(),
  };
}

/**
 * Add or update a page in the sync state
 * Per ADR-0024: Only stores the mapping (pageId -> localPath)
 * Version, title, timestamps are read from frontmatter when needed
 *
 * @param config - Current space configuration
 * @param pageInfo - Page info (only pageId and localPath are stored)
 */
export function updatePageSyncInfo(
  config: SpaceConfigWithState,
  pageInfo: { pageId: string; localPath: string },
): SpaceConfigWithState {
  return {
    ...config,
    pages: {
      ...config.pages,
      [pageInfo.pageId]: pageInfo.localPath,
    },
  };
}

/**
 * Remove a page from the sync state
 */
export function removePageSyncInfo(config: SpaceConfigWithState, pageId: string): SpaceConfigWithState {
  const { [pageId]: _, ...remainingPages } = config.pages;
  return {
    ...config,
    pages: remainingPages,
  };
}

/**
 * Get all tracked page IDs
 */
export function getTrackedPageIds(config: SpaceConfigWithState): string[] {
  return Object.keys(config.pages);
}

/**
 * Add or update a folder in the sync state
 * Per ADR-0023: Folder push workflow support
 */
export function updateFolderSyncInfo(config: SpaceConfigWithState, folderInfo: FolderSyncInfo): SpaceConfigWithState {
  return {
    ...config,
    folders: {
      ...(config.folders || {}),
      [folderInfo.folderId]: folderInfo,
    },
  };
}

/**
 * Get a folder by its local path
 * Per ADR-0023: Folder push workflow support
 */
export function getFolderByPath(config: SpaceConfigWithState, localPath: string): FolderSyncInfo | undefined {
  if (!config.folders) return undefined;
  for (const folder of Object.values(config.folders)) {
    if (folder.localPath === localPath) {
      return folder;
    }
  }
  return undefined;
}

/**
 * Get a folder by its ID
 * Per ADR-0023: Folder push workflow support
 */
export function getFolderById(config: SpaceConfigWithState, folderId: string): FolderSyncInfo | undefined {
  return config.folders?.[folderId];
}

/**
 * Remove a folder from the sync state
 * Per ADR-0023: Folder push workflow support
 */
export function removeFolderSyncInfo(config: SpaceConfigWithState, folderId: string): SpaceConfigWithState {
  if (!config.folders) return config;
  const { [folderId]: _, ...remainingFolders } = config.folders;
  return {
    ...config,
    folders: remainingFolders,
  };
}
