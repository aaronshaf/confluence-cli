# ADR 0007: One-Way Sync for Initial Release

## Status

Accepted

## Context

Need to determine sync direction between Confluence and local files.

Options:
1. **One-way (Confluence → local)** - Read-only local mirror
2. **Bidirectional** - Edit locally, push to Confluence
3. **Two-way with conflict resolution** - Full sync with merge

## Decision

Implement one-way sync (Confluence → local) for initial release. Bidirectional sync planned for future.

## Rationale

- **Simplicity**: One-way sync is dramatically simpler
- **Safety**: No risk of overwriting Confluence content
- **Confluence as source of truth**: Most teams edit in Confluence
- **Incremental delivery**: Ship useful tool faster, add features later
- **Conflict avoidance**: No merge conflicts to handle

## Consequences

### Positive
- Faster initial release
- No data loss risk
- Simpler mental model for users
- Clear source of truth

### Negative
- Can't edit locally and push back (yet)
- Local changes will be overwritten on sync
- Some users may want bidirectional from start

## Future Work

When implementing bidirectional sync:
1. Track local modifications (file hash comparison)
2. Detect conflicts (local + remote changed)
3. Implement conflict resolution UI
4. Add `cn push` command
5. Consider `cn diff` for previewing changes
