# ADR 0021: Use Meilisearch for Local Search

## Status

Accepted

## Context

Users need fast, offline search across synced Confluence content. Current options are inadequate:

- **grep/ripgrep** - No typo tolerance, no relevance ranking, no filtering by metadata
- **Confluence web search** - Requires network, slow, searches unrelated spaces
- **Browser-based full-text search (lunr.js, flexsearch)** - Limited features, no persistence

We need a search solution that provides:
1. Sub-50ms query response for 1000+ documents
2. Typo tolerance ("authentcation" finds "authentication")
3. Relevance ranking
4. Filtering by metadata (labels, author, date)
5. Offline operation

Options evaluated:

| Option | Typo Tolerance | Speed | Filtering | Setup Complexity |
|--------|---------------|-------|-----------|------------------|
| **Meilisearch** | Excellent | < 50ms | Rich | Docker/binary |
| **Typesense** | Good | < 50ms | Rich | Docker/binary |
| **Elasticsearch** | Good | Variable | Rich | Heavy, complex |
| **SQLite FTS5** | None | Fast | Basic | Embedded |
| **MiniSearch** | Basic | Fast | Limited | Embedded (JS) |
| **FlexSearch** | Basic | Fast | Limited | Embedded (JS) |

## Decision

Use **Meilisearch** as an external search engine that users run locally.

```bash
# User runs Meilisearch
docker run -d -p 7700:7700 getmeili/meilisearch:latest

# cn indexes and searches
cn search index
cn search "authentication"
```

## Rationale

### Why Meilisearch over alternatives

1. **Best-in-class typo tolerance** - Handles misspellings gracefully out of the box
2. **Instant search** - Sub-50ms responses, even for large indexes
3. **Simple setup** - Single binary or Docker container, zero configuration needed
4. **Rich filtering** - Filter by any indexed attribute (labels, author, dates)
5. **Excellent JS SDK** - First-class TypeScript support, well-documented
6. **Active development** - Regular releases, growing community
7. **Lightweight** - Much simpler than Elasticsearch, suitable for local use

### Why external vs embedded

1. **Feature richness** - Embedded solutions (MiniSearch, FlexSearch) lack typo tolerance and rich filtering
2. **Persistence** - External index persists across sessions without managing state files
3. **Performance** - Native Rust implementation faster than JS-based alternatives
4. **Separation of concerns** - Search engine maintained separately from cn

### Trade-offs accepted

1. **User must run Meilisearch** - Additional setup step, but Docker makes it simple
2. **Network hop (localhost)** - Minimal latency impact for local connections
3. **Resource usage** - Meilisearch uses ~50-100MB RAM for typical indexes

## Consequences

### Positive

- Fast, typo-tolerant search across all synced content
- Filter by labels, author, date ranges
- Works completely offline once indexed
- Relevance-ranked results
- Scales well with content size

### Negative

- Users must install and run Meilisearch
- Index becomes stale if not updated after `cn pull`
- Additional dependency to document and support

### Mitigations

- Provide clear setup instructions (Docker one-liner)
- `cn search status` shows connection status and helps diagnose issues
- Suggest re-indexing after pull operations
- Future: `cn pull --index` flag for automatic re-indexing

## Implementation Notes

### Index per space

Each Confluence space gets its own Meilisearch index:

```
cn-ENG     # Engineering space
cn-DOCS    # Documentation space
```

### Indexed fields

From markdown frontmatter:

```typescript
interface SearchDocument {
  id: string           // page_id
  title: string        // Searchable, high priority
  content: string      // Searchable, lower priority
  labels: string[]     // Filterable
  author_email: string // Filterable
  updated_at: number   // Sortable
  local_path: string   // Display
}
```

### Configuration

Optional in `.confluence.json`:

```json
{
  "search": {
    "meilisearchUrl": "http://localhost:7700",
    "apiKey": null
  }
}
```

## References

- [Meilisearch Documentation](https://www.meilisearch.com/docs)
- [Meilisearch vs Typesense Comparison](https://www.meilisearch.com/blog/typesense-review)
- [Meilisearch JavaScript SDK](https://github.com/meilisearch/meilisearch-js)
- [PRD: cn search](../prd/search.md)
