# ADR 0016: bunfig.toml Configuration

## Status

Accepted

## Context

Bun uses `bunfig.toml` for runtime and test configuration. Need to define our configuration.

## Decision

Use bunfig.toml for test preloading and runtime settings, matching ji patterns.

## Configuration

### bunfig.toml
```toml
[test]
# Preload MSW setup before any tests run
preload = ["./src/test/setup-msw.ts"]

# Coverage settings
coverage = true
coverageDir = "./coverage"

[install]
# Use exact versions for reproducibility
exact = true
```

## Key Settings

### Test Preloading

```toml
[test]
preload = ["./src/test/setup-msw.ts"]
```

**Why preload MSW?**
- MSW must intercept fetch before any test imports
- Ensures consistent mock server across all tests
- Prevents race conditions with global fetch

### Coverage Directory

```toml
coverageDir = "./coverage"
```

Standard location for coverage reports, gitignored.

### Exact Versions

```toml
[install]
exact = true
```

Ensures `bun add` uses exact versions, improving reproducibility.

## Test Execution

Combined with package.json scripts:

```json
{
  "scripts": {
    "test": "BUN_TEST_JOBS=1 NODE_ENV=test bun test",
    "test:coverage": "BUN_TEST_JOBS=1 NODE_ENV=test bun test --coverage"
  }
}
```

**Why `BUN_TEST_JOBS=1`?**
- Serial test execution
- Avoids race conditions with shared MSW server
- More predictable test output

**Why `NODE_ENV=test`?**
- Signals test environment to code
- Enables test-only protections (block real API calls)

## Consequences

### Positive
- MSW initialized before all tests
- Consistent test environment
- Reproducible builds with exact versions

### Negative
- Serial tests are slower than parallel
- Preload adds slight startup time
