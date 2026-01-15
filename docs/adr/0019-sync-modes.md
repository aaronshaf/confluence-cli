# ADR 0019: Sync Modes - Smart vs Full

## Status

Accepted

## Context

Users need different sync behaviors depending on their situation:

1. **Incremental updates** - Most common case, only fetch changed pages
2. **Full refresh** - When local state is corrupted or needs complete reset
3. **Preview changes** - See what would sync before committing

## Decision

Support two primary sync modes plus a preview option:

### Smart Sync (Default)
```bash
cn sync
```

- Compares local version numbers against remote
- Only downloads pages where `remoteVersion > localVersion`
- Handles title/parent changes by moving files
- Most efficient for regular use

### Full Sync
```bash
cn sync --force
```

- Re-downloads all pages regardless of local state
- Treats every page as "added"
- Useful when:
  - Local state is corrupted
  - `.confluence.json` was deleted/modified
  - Need to ensure complete sync

### Dry Run (Preview)
```bash
cn sync --dry-run
```

- Shows what would be synced without making changes
- Works with both smart and full modes
- Useful for seeing changes before committing

## Rationale

- **Smart sync as default**: Most users want incremental updates; full sync is expensive
- **Version-based detection**: Confluence versions increment on every edit, reliable change detection
- **Automatic rename handling**: Smart sync detects title changes and moves files accordingly
- **`--force` alias**: Familiar to git users, kept for backwards compatibility

## Implementation

Smart sync diff logic:
```typescript
if (!localPage) {
  // Added
} else if (remoteVersion > localPage.version) {
  // Modified (content, title, or parent changed)
}
// Pages in local but not remote → Deleted
```

Full sync forces all pages into "added" state:
```typescript
const diff = options.force
  ? { added: remotePages.map(p => ({ type: 'added', ... })), modified: [], deleted: [] }
  : this.computeDiff(remotePages, config);
```

## Consequences

### Positive
- Efficient incremental sync by default
- Full sync available when needed
- Preview prevents accidental changes

### Negative
- Full sync re-downloads unchanged content (bandwidth cost)
- Smart sync relies on accurate local state
