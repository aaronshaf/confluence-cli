# ADR 0015: Biome Configuration

## Status

Accepted

## Context

Need a linting and formatting tool for TypeScript code quality.

Options:
1. **ESLint + Prettier** - Traditional, widely used
2. **Biome** - Fast, all-in-one linter/formatter
3. **deno lint** - Deno's built-in linter

## Decision

Use Biome for linting and formatting, matching ji's configuration.

## Rationale

- **Speed**: Significantly faster than ESLint
- **All-in-one**: Replaces both ESLint and Prettier
- **Consistency**: Same config as ji project
- **Modern**: Built for modern JS/TS patterns

## Configuration

### biome.json
```json
{
  "$schema": "https://biomejs.dev/schemas/2.1.1/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineEnding": "lf",
    "lineWidth": 120
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn",
        "noDoubleEquals": "warn",
        "noImplicitAnyLet": "warn",
        "noAssignInExpressions": "off"
      },
      "complexity": {
        "noStaticOnlyClass": "off"
      },
      "correctness": {
        "noUnusedImports": "off"
      }
    }
  },
  "overrides": [
    {
      "includes": ["**/*.test.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    }
  ],
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always"
    }
  }
}
```

## Key Decisions

| Setting | Value | Rationale |
|---------|-------|-----------|
| `lineWidth` | 120 | Readable but not overly restrictive |
| `indentWidth` | 2 | Standard for TS projects |
| `quoteStyle` | single | Consistency, less visual noise |
| `noExplicitAny` | warn | Pragmatic - avoid but don't block |
| `noUnusedImports` | off | Avoid conflicts with auto-fixing |

## Test File Relaxations

Test files (`**/*.test.ts`) have relaxed rules:
- `noExplicitAny: off` - Mocking often needs `any`

## Scripts

```json
{
  "scripts": {
    "lint": "biome check",
    "lint:fix": "biome check --write",
    "format": "biome format --write"
  }
}
```

## Consequences

### Positive
- Fast linting (10x+ faster than ESLint)
- Single tool for lint + format
- Good IDE integration
- Consistent with ji

### Negative
- Fewer rules than ESLint ecosystem
- Less plugin ecosystem
- Newer tool, still evolving
