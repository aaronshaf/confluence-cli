# ADR 0001: Use Effect for Error Handling

## Status

Accepted

## Context

We need to decide on an error handling strategy for the `cn` CLI. Options considered:

1. **Traditional try/catch** - Simple but errors lose type information
2. **Result types (manual)** - Explicit but verbose
3. **Effect library** - Type-safe, composable, matches `ji` patterns

## Decision

Use the Effect library for error handling and async operations.

## Rationale

- **Type-safe errors**: Effect tracks error types at compile time
- **Composability**: Operations compose naturally with `pipe()` and `Effect.flatMap`
- **Consistency**: Matches the `ji` project patterns (same author)
- **Resource management**: Effect provides `Effect.scoped` for cleanup
- **Dual API**: Can provide both async and Effect-based methods for flexibility

## Consequences

### Positive
- Compile-time error tracking
- Clear error handling paths
- Easier testing with controlled effects
- Familiar patterns for anyone who's worked with `ji`

### Negative
- Learning curve for Effect newcomers
- Additional dependency
- Slightly more verbose than simple async/await

## Example

```typescript
// Error types
class ConfigError extends Error { readonly _tag = 'ConfigError' }
class ApiError extends Error { readonly _tag = 'ApiError' }

// Effect-based function
const getConfig = (): Effect<Config, ConfigError> =>
  pipe(
    Effect.tryPromise({
      try: () => readFile(configPath),
      catch: () => new ConfigError('Failed to read config')
    }),
    Effect.flatMap(parseConfig)
  )
```
