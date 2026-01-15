# ADR 0013: TypeScript Isolated Declarations

## Status

Accepted (planned)

## Context

TypeScript 5.5+ introduces `isolatedDeclarations` which requires explicit return types on exported functions. This enables faster declaration emit and better tooling.

Options:
1. **Disabled** - Inferred types everywhere
2. **Enabled** - Explicit types on all exports

## Decision

Enable `isolatedDeclarations: true` in tsconfig.json.

## Rationale

- **Faster builds**: Declaration files can be generated without full type checking
- **Better documentation**: Explicit types serve as documentation
- **API clarity**: Public API is clearly typed
- **Future-proof**: Aligns with TypeScript direction
- **ji pattern**: ji has this as a TODO, we can implement it from start

## Implementation

### tsconfig.json
```json
{
  "compilerOptions": {
    "isolatedDeclarations": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

### Code Impact

Before (implicit):
```typescript
export function slugify(title: string) {
  return title.toLowerCase().replace(/\s+/g, '-');
}
```

After (explicit):
```typescript
export function slugify(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-');
}
```

### Effect Types
```typescript
// Must be explicit about Effect return types
export function getConfig(): Effect.Effect<Config, ConfigError> {
  // ...
}

export function syncSpace(
  spaceKey: string
): Effect.Effect<SyncResult, ApiError | SyncError> {
  // ...
}
```

## Consequences

### Positive
- Clearer public API
- Faster tooling (IDE, build)
- Catches missing return types early
- Better generated documentation

### Negative
- More verbose code
- Must annotate all exports
- Some complex types are tedious to write

## Exceptions

Internal/private functions don't need explicit types:
```typescript
// Internal helper - no annotation needed
function parseResponse(data: unknown) {
  // ...
}

// Exported - needs annotation
export function fetchPage(id: string): Effect.Effect<Page, ApiError> {
  // ...
}
```
