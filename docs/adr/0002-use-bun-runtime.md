# ADR 0002: Use Bun Runtime

## Status

Accepted

## Context

Need to choose a JavaScript/TypeScript runtime for the CLI tool.

Options:
1. **Node.js** - Mature, widely adopted
2. **Deno** - Modern, built-in TypeScript
3. **Bun** - Fast, all-in-one toolkit

## Decision

Use Bun as the runtime.

## Rationale

- **Performance**: Bun is significantly faster than Node.js for CLI startup
- **Built-in TypeScript**: No separate compilation step needed
- **All-in-one**: Bundler, test runner, package manager included
- **Consistency**: Matches the `ji` project which also uses Bun
- **Native APIs**: Fast file I/O with `Bun.file()` and `Bun.write()`

## Consequences

### Positive
- Fast CLI startup time
- Simplified toolchain (no separate bundler/test runner)
- Direct TypeScript execution
- Modern APIs

### Negative
- Less mature than Node.js
- Some npm packages may have compatibility issues
- Users need Bun installed (not as ubiquitous as Node)

## Notes

Minimum Bun version: 1.2.0
