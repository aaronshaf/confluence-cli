# ADR 0008: Use MSW for API Mocking in Tests

## Status

Accepted

## Context

Need a strategy for testing code that makes HTTP requests to the Confluence API without hitting real endpoints.

Options:
1. **Manual fetch mocking** - Replace global fetch
2. **MSW (Mock Service Worker)** - Intercept at network level
3. **Dependency injection** - Pass mock clients

## Decision

Use MSW (Mock Service Worker) for HTTP mocking, preloaded via `bunfig.toml`.

## Rationale

- **Network-level interception**: Tests real fetch calls, not mocked implementations
- **Proven pattern**: Used successfully in ji project
- **Handler-based**: Easy to define responses per endpoint
- **Reset between tests**: Clean state via `server.resetHandlers()`
- **Bun compatible**: Works with Bun's test runner

## Implementation

### bunfig.toml
```toml
[test]
preload = ["./src/test/setup-msw.ts"]
```

### setup-msw.ts
```typescript
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

export const server = setupServer(...handlers);

let serverStarted = false;

beforeAll(async () => {
  if (!serverStarted) {
    server.listen({ onUnhandledRequest: 'warn' });
    serverStarted = true;
  }
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
```

### Mock Handlers
```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://*.atlassian.net/wiki/api/v2/spaces', () => {
    return HttpResponse.json({ results: [...] });
  }),

  http.get('https://*.atlassian.net/wiki/api/v2/pages/:pageId', ({ params }) => {
    return HttpResponse.json({ id: params.pageId, ... });
  }),
];
```

## Consequences

### Positive
- Tests exercise real HTTP code paths
- Easy to simulate error responses (401, 429, 500)
- Handlers are reusable across tests
- No production code changes needed for testing

### Negative
- Additional dev dependency
- Must keep handlers in sync with real API
- Preload setup adds slight complexity

## Test Patterns

### Schema Validation for Mocks
```typescript
// Validate mock data matches expected schema
export function createValidPage(overrides = {}): ConfluencePage {
  const page = { ...defaultPage, ...overrides };
  Schema.decodeSync(PageSchema)(page); // Throws if invalid
  return page;
}
```

### Test Environment Protection
```typescript
// Prevent accidental real API calls in tests
if (process.env.NODE_ENV === 'test' && !process.env.ALLOW_REAL_API_CALLS) {
  throw new Error('Real API calls blocked in test environment');
}
```
