# cn

CLI for syncing Confluence spaces to local markdown.

## Install

```bash
bun install -g @aaronshaf/cn
```

## Getting Started

```bash
# 1. Configure your Confluence credentials
cn setup

# 2. Create a directory for the space
mkdir my-space && cd my-space

# 3. Initialize the space
cn sync --init <SPACE_KEY>

# 4. Download the pages
cn sync
```

The space key is the identifier in your Confluence URL:
`https://yoursite.atlassian.net/wiki/spaces/<SPACE_KEY>/...`

Credentials are stored in `~/.cn/config.json`. Space configuration is saved to `.confluence.json` in the synced directory.

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
