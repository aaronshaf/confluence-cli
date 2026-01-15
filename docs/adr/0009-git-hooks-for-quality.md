# ADR 0009: Git Hooks for Code Quality

## Status

Accepted

## Context

Need automated quality checks to prevent problematic code from being committed.

Options:
1. **No hooks** - Rely on CI only
2. **Husky** - Popular hook manager
3. **Custom scripts** - Self-installed via `prepare` script

## Decision

Use custom git hooks installed automatically via `prepare` script in package.json, matching ji's pattern.

## Rationale

- **No extra dependencies**: Just a Node.js script
- **Automatic installation**: Runs on `bun install`
- **Full control**: Custom checks specific to project
- **Proven**: Works well in ji project

## Implementation

### package.json
```json
{
  "scripts": {
    "prepare": "node scripts/install-hooks.cjs",
    "pre-commit": "bun run typecheck && biome check --write && bun run check-file-sizes",
    "typecheck": "tsc --noEmit",
    "check-file-sizes": "bun run scripts/check-file-sizes.ts"
  }
}
```

### scripts/install-hooks.cjs
```javascript
#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const preCommitScript = `#!/bin/sh
echo "Running pre-commit checks..."

# Type checking
echo "Checking TypeScript..."
bun run typecheck || exit 1

# Biome with auto-fix
echo "Running Biome..."
bun run biome check --write .
git add -u

# File size check
echo "Checking file sizes..."
bun run check-file-sizes || exit 1

echo "✅ Pre-commit checks passed!"
`;

const hooksDir = path.join('.git', 'hooks');
fs.mkdirSync(hooksDir, { recursive: true });
fs.writeFileSync(path.join(hooksDir, 'pre-commit'), preCommitScript);
fs.chmodSync(path.join(hooksDir, 'pre-commit'), '755');
console.log('✅ Git hooks installed');
```

### File Size Limits
```typescript
// scripts/check-file-sizes.ts
const LIMITS = {
  warning: 500,   // lines - warn above this
  blocking: 700,  // lines - block above this
};
```

## Pre-commit Checks (in order)

1. **TypeScript** - `tsc --noEmit`
2. **Biome** - Format and lint with auto-fix
3. **Stage fixes** - `git add -u` to include Biome fixes
4. **File sizes** - Warn >500 lines, block >700 lines

## Consequences

### Positive
- Catch errors before they reach CI
- Auto-fix formatting issues
- Enforce code modularity via size limits
- Zero-config for developers (auto-installs)

### Negative
- Slightly slower commits
- Developers can bypass with `--no-verify`
- Must maintain hook script

## File Size Philosophy

Large files indicate:
- Too many responsibilities
- Missing abstractions
- Harder to test and maintain

Limits encourage:
- Smaller, focused modules
- Better separation of concerns
- Easier code review
