# ADR 0023: Folder Push Workflow

## Status

Accepted

## Context

ADR-0020 established the push command for pushing markdown files to Confluence. However, when pushing files in subdirectories, the push command did not automatically create the corresponding Confluence folder hierarchy. Users had to either:

1. Manually create folders in Confluence first
2. Specify `parent_id` in frontmatter pointing to an existing page/folder

Additionally, the Confluence v2 API has a limitation: creating pages with a folder as `parentId` doesn't work - the folder parent is silently ignored and the page is created at the space root.

## Decision

Implement automatic folder hierarchy creation during push:

1. **Auto-create folders**: When pushing a file in a subdirectory (e.g., `docs/api/endpoints.md`), automatically create the folder hierarchy (`docs/` folder, then `docs/api/` folder) if it doesn't exist.

2. **Track folders in config**: Store folder mappings in `.confluence.json` so subsequent pushes can reuse existing folders.

3. **Use move workaround**: Since the v2 API can't create pages directly under folders, create the page first (at space root), then use the v1 Move API to relocate it into the folder.

4. **User confirmation**: Prompt for y/n confirmation before creating each folder to prevent unintended changes.

### Folder Tracking in Config

```json
{
  "spaceKey": "TEST",
  "spaceId": "123",
  "spaceName": "Test Space",
  "pages": { ... },
  "folders": {
    "folder-id-1": {
      "folderId": "folder-id-1",
      "title": "docs",
      "localPath": "docs"
    },
    "folder-id-2": {
      "folderId": "folder-id-2",
      "title": "api",
      "parentId": "folder-id-1",
      "localPath": "docs/api"
    }
  }
}
```

### Push Workflow with Folders

```bash
$ cn push docs/api/endpoints.md
Creating: endpoints
  (New page - no page_id in frontmatter)
  Converting markdown to HTML...
? Create folder "docs" on Confluence? y
  Creating folder: docs...
  Created folder: docs (id: 123456)
? Create folder "api" on Confluence? y
  Creating folder: api...
  Created folder: api (id: 789012)
  Creating page on Confluence...
  Moving page into folder...
  Moved page to folder

Created: endpoints (page_id: 345678)
```

### Pull Workflow Enhancement

During pull (`cn pull`), discovered folders are now tracked in `.confluence.json`:

```bash
$ cn pull
Fetching pages...  [47 pages, 3 folders]
...
```

This enables push to find and reuse existing folders by path.

## API Details

### Create Folder (v2 API)

```
POST /wiki/api/v2/folders
{
  "spaceId": "123",
  "title": "Folder Name",
  "parentId": "optional-parent-folder-id"
}
```

### Move Page (v1 API)

```
PUT /wiki/rest/api/content/{pageId}/move/append/{targetFolderId}
```

The v1 Move API is used because:
- The v2 API doesn't support setting folder parents during page creation
- Move operation reliably places pages under folders

## Edge Cases

| Case | Handling |
|------|----------|
| Folder already exists (by path) | Reuse existing folder ID from config |
| Folder deleted on Confluence | Warn user; page remains at space root. Intended `parent_id` preserved for retry. |
| Move operation fails | Warn user; page created but at space root. Intended `parent_id` preserved for retry. |
| Explicit `parent_id` in frontmatter | Skip auto-folder creation, use explicit parent |
| Root-level files | No folder creation needed |
| Deeply nested directories | Create folders iteratively from root to leaf (max 10 levels) |
| User declines folder creation | Abort push with error message |
| Duplicate folder title | Error with suggestion to run `cn pull` to sync existing folders |
| Path traversal (e.g., `../`) | Rejected with validation error |
| Invalid characters in folder name | Sanitized (special chars replaced with `-`) |
| Circular reference in hierarchy | Warning logged; path truncated to prevent infinite loop |
| Rate limiting (429) | Automatic retry with exponential backoff |

## Rationale

### Why auto-create folders?

- Matches user expectation: local directory structure should mirror Confluence hierarchy
- Reduces friction: no need to manually create folders or specify parent IDs
- Enables batch push of files in subdirectories

### Why track folders in config?

- Enables reuse: subsequent pushes don't recreate existing folders
- Fast lookup: find folder ID by local path without API calls
- Pull integration: folders discovered during pull are tracked for push

### Why the create-then-move approach?

- Confluence v2 API limitation: parentId for folders is ignored during page creation
- Move API works reliably for placing pages under folders
- Two-step approach is more robust than trying to work around API limitations

### Why prompt for each folder?

- Safety: prevents accidentally creating many folders
- Transparency: user knows exactly what's being created
- Consistent with batch push y/n prompts (ADR-0020)

## Consequences

### Positive

- Users can push files in subdirectories without manual setup
- Folder structure automatically mirrors local directory structure
- Folders are tracked and reused across push/pull operations
- Clear prompts prevent unintended folder creation

### Negative

- Additional API calls for folder creation and page move
- Two-step create-then-move is slower than direct creation would be
- Users may be surprised by folder prompts if they expect silent operation

## Implementation Files

| File | Changes |
|------|---------|
| `src/lib/confluence-client/types.ts` | Add `CreateFolderRequestSchema`, `MovePageResponseSchema` |
| `src/lib/confluence-client/client.ts` | Add `createFolder()`, `movePage()` methods |
| `src/lib/space-config.ts` | Add `FolderSyncInfo`, `folders` field, helper functions |
| `src/cli/commands/push.ts` | Add `ensureFolderHierarchy()`, update `createNewPage()` |
| `src/lib/sync/sync-engine.ts` | Track folders in config during pull |
| `src/lib/errors.ts` | Add `FolderNotFoundError` |
