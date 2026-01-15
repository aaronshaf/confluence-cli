# ADR 0017: Dual Async/Effect API Pattern

## Status

Accepted

## Context

We're using Effect for error handling, but some consumers may prefer simple async/await. Need to decide on API design.

## Decision

Provide both async and Effect-based methods for public APIs, with Effect as the primary implementation.

## Rationale

- **Flexibility**: Users can choose their preferred style
- **Gradual adoption**: Start with async, migrate to Effect over time
- **ji pattern**: Proven approach in ji project
- **Internal consistency**: Effect internally, async for convenience

## Implementation

### Pattern

```typescript
class ConfluenceClient {
  // Effect-based (primary implementation)
  getPageEffect(pageId: string): Effect.Effect<Page, ApiError> {
    return pipe(
      Effect.tryPromise({
        try: () => this.fetchPage(pageId),
        catch: (e) => new ApiError(`Failed to fetch page: ${e}`)
      }),
      Effect.flatMap(this.validatePage)
    );
  }

  // Async wrapper (convenience)
  async getPage(pageId: string): Promise<Page> {
    return Effect.runPromise(this.getPageEffect(pageId));
  }
}
```

### Naming Convention

| Style | Method Name | Return Type |
|-------|-------------|-------------|
| Effect | `getPageEffect` | `Effect<Page, ApiError>` |
| Async | `getPage` | `Promise<Page>` |

The `Effect` suffix clearly indicates the Effect-based version.

### When to Use Each

**Use Effect methods when:**
- Composing multiple operations
- Need fine-grained error handling
- Building pipelines with retry/timeout
- Writing library code

**Use async methods when:**
- Simple one-off calls
- CLI command handlers
- Quick scripts
- Familiar async/await is sufficient

## Example Usage

### Effect Style
```typescript
const result = await Effect.runPromise(
  pipe(
    client.getPageEffect(pageId),
    Effect.flatMap(page =>
      client.getChildrenEffect(page.id)
    ),
    Effect.retry(retrySchedule),
    Effect.timeout('30 seconds')
  )
);
```

### Async Style
```typescript
try {
  const page = await client.getPage(pageId);
  const children = await client.getChildren(page.id);
} catch (error) {
  console.error('Failed:', error.message);
}
```

## Consequences

### Positive
- Supports both programming styles
- Effect benefits available when needed
- Simple async for straightforward cases
- Easier onboarding for Effect newcomers

### Negative
- Two methods per operation (more code)
- Must keep both in sync
- Potential confusion about which to use

## Guidelines

1. Implement Effect version first (primary)
2. Async is thin wrapper calling Effect
3. Document both in JSDoc
4. Tests should cover both APIs
