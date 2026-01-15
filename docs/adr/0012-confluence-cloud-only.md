# ADR 0012: Confluence Cloud Only

## Status

Accepted

## Context

Confluence exists in two forms:
1. **Confluence Cloud** - SaaS at `*.atlassian.net`
2. **Confluence Data Center** - Self-hosted, different API

Need to decide which to support.

## Decision

Support Confluence Cloud only for initial release.

## Rationale

- **Simpler implementation**: Single API version, single auth method
- **Most common**: Majority of users are on Cloud
- **Consistent URLs**: Always `*.atlassian.net`
- **API v2**: Cloud has newer, better-documented REST API v2
- **Faster delivery**: Ship sooner, add Data Center later if needed

## Differences

| Aspect | Cloud | Data Center |
|--------|-------|-------------|
| URL | `*.atlassian.net` | Custom domain |
| API | REST v2 | REST v1 (different) |
| Auth | Basic (email + API token) | Basic or OAuth, cookies |
| Rate limits | Standardized | Varies |

## Implementation

### URL Validation
```typescript
const ConfigSchema = Schema.Struct({
  confluenceUrl: Schema.String.pipe(
    Schema.pattern(/^https:\/\/.+\.atlassian\.net$/)
  ),
  // ...
});
```

### Error Message
```
✗ Invalid Confluence URL.
  cn currently only supports Confluence Cloud (*.atlassian.net).
  Data Center support may be added in a future release.
```

## Consequences

### Positive
- Simpler codebase
- Faster initial release
- Easier to test (consistent environment)
- Better documentation (single API)

### Negative
- Excludes Data Center users
- May need significant work to add later
- Some enterprise users can't use cn

## Future Consideration

If adding Data Center support:
1. Detect instance type from URL
2. Use appropriate API client
3. Handle different auth methods
4. Test against Data Center instance

This would likely warrant a new ADR and significant refactoring.
