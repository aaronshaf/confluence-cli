# cn

CLI for syncing Confluence spaces to local markdown.

## Install

```bash
bun install -g @aaronshaf/cn
```

## Setup

```bash
cn setup
```

Stores credentials in `~/.cn/config.json`.

## Usage

```bash
# Sync a space to current directory
cn sync

# Check connection status
cn status

# View page hierarchy
cn tree

# Open page in browser
cn open
```

## Requirements

- Bun 1.2.0+
- Confluence Cloud account

## Development

```bash
bun install
bun run cn --help
bun test
```

## License

MIT
