# ADR 0014: Code Coverage Enforcement

## Status

Accepted

## Context

Need a strategy for ensuring adequate test coverage.

Options:
1. **No enforcement** - Coverage as informational only
2. **CI-only enforcement** - Check in pipeline
3. **Pre-commit enforcement** - Block commits below threshold

## Decision

Enforce minimum code coverage in pre-commit hooks, matching ji pattern.

## Rationale

- **Early feedback**: Catch coverage gaps before push
- **Consistent quality**: All commits meet threshold
- **Developer awareness**: Makes coverage visible
- **ji pattern**: Proven approach in ji project

## Implementation

### package.json Scripts
```json
{
  "scripts": {
    "test": "BUN_TEST_JOBS=1 NODE_ENV=test bun test",
    "test:coverage": "BUN_TEST_JOBS=1 NODE_ENV=test bun test --coverage",
    "test:coverage:check": "BUN_TEST_JOBS=1 NODE_ENV=test bun test --coverage --coverage-threshold=70"
  }
}
```

### Pre-commit Hook
```bash
# Run coverage check
echo "Checking test coverage..."
bun run test:coverage:check
if [ $? -ne 0 ]; then
  echo "❌ Test coverage below minimum threshold. Commit aborted."
  exit 1
fi
```

### Threshold Strategy

| Phase | Threshold | Rationale |
|-------|-----------|-----------|
| Initial | 70% | Reasonable starting point |
| Growth | 80% | Increase as codebase matures |
| Target | 85% | Sustainable long-term goal |

### Serial Test Execution
```bash
BUN_TEST_JOBS=1  # Run tests serially to avoid race conditions
NODE_ENV=test    # Signal test environment
```

## Consequences

### Positive
- Guaranteed minimum coverage
- Prevents coverage regression
- Makes untested code visible
- Builds confidence in codebase

### Negative
- Slower commits (must run tests)
- Can encourage low-quality tests just to hit threshold
- May block urgent fixes

## Bypassing (Emergency Only)
```bash
git commit --no-verify -m "Emergency fix"
```

Use sparingly - coverage debt should be paid immediately.

## Coverage Reporting
```
$ bun test --coverage

Running tests...
✓ config.test.ts (5 tests)
✓ sync.test.ts (12 tests)

Coverage:
  src/lib/config.ts      95.2%
  src/lib/sync.ts        82.1%
  src/cli/commands/*.ts  71.3%
  ─────────────────────────────
  Total:                 78.4%  ✓ (threshold: 70%)
```

## Excluded from Coverage

Some files may be excluded:
- `src/cli.ts` - Entry point shebang
- `src/test/**` - Test files themselves
- Type definition files
