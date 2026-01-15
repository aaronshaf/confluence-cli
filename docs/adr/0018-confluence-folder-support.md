# ADR 0018: Confluence Folder Support via V2 API

## Status

Accepted

## Context

Confluence Cloud has a "folder" content type separate from pages. Folders can contain pages and other folders, creating hierarchy. The v2 API handles folders differently from pages:

- `/pages` endpoint returns only pages, not folders
- `/folders/{id}` endpoint returns individual folder details
- `/folders` list endpoint returns 500 (appears buggy/unsupported)
- Pages reference folder parents via `parentId`

Without folder support, pages inside folders appear as orphans with missing parents, breaking the hierarchy.

Options considered:

1. **V1 API with recursive expansion** - Use `/rest/api/content/{id}?expand=children.page,children.folder`
2. **V2 API with folder discovery** - Fetch pages via v2, discover missing folder parents, fetch via `/folders/{id}`
3. **Ignore folders** - Treat folder children as root-level pages

## Decision

Use V2 API with folder discovery (Option 2).

## Rationale

- **V2 API preference**: Project aims to use v2 API consistently (see ADR-0012)
- **Minimal API calls**: Only fetches folders that are actually referenced as parents
- **Forward compatible**: V2 folders endpoint may improve; approach adapts easily
- **Hierarchy preserved**: Pages correctly nested under their folder parents

## Implementation

1. Fetch all pages in space via `/spaces/{id}/pages`
2. Collect `parentId` values not found in pages list
3. For each missing parent, attempt `/folders/{parentId}`
4. Build combined page+folder tree
5. Sync folders as directories (no `index.md` since folders have no content)

## Consequences

### Positive
- Correct hierarchy representation
- Uses v2 API primarily
- Efficient - only fetches needed folders

### Negative
- Extra API calls for spaces with folders
- Folders don't have markdown content (empty directories or placeholder)

## Folder Representation

Folders become directories in the local filesystem:

```
space/
├── overview/
│   ├── index.md           # Overview page
│   ├── hello-world.md     # Child page
│   └── test-folder/       # Confluence folder (directory only)
│       └── nested-page.md # Page inside folder
```

Folder metadata stored in `.confluence.json` for tracking.
