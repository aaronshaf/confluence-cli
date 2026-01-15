# ADR 0003: Store Credentials in Home Directory

## Status

Accepted

## Context

Need to determine where to store user credentials (Confluence URL, email, API token).

Options:
1. **Environment variables** - `CONFLUENCE_URL`, `CONFLUENCE_TOKEN`, etc.
2. **Project-level config** - `.cn/config.json` in project root
3. **Home directory** - `~/.cn/config.json`

## Decision

Store credentials in `~/.cn/config.json` with 600 file permissions.

## Rationale

- **Security**: Home directory config avoids accidentally committing credentials
- **Convenience**: Single configuration for all projects
- **Permissions**: 600 mode ensures only owner can read/write
- **Pattern**: Matches `ji` project (`~/.ji/config.json`)
- **Discoverability**: Standard location for CLI configs

## Consequences

### Positive
- Credentials never in project directories (can't be committed)
- Works across all sync directories
- File permissions provide OS-level protection
- Familiar pattern for CLI users

### Negative
- Per-machine configuration (not shared across machines)
- Multiple Confluence instances would need config switching (future enhancement)

## Implementation

```typescript
const configPath = path.join(os.homedir(), '.cn', 'config.json')

// Set secure permissions
chmodSync(configPath, 0o600)
```
