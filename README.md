# confluence-cli

## Installation

```bash
# Install Bun runtime
curl -fsSL https://bun.sh/install | bash

# Install confluence-cli
bun install -g @aaronshaf/confluence-cli
```

## Getting Started

```bash
# 1. Configure your Confluence credentials
cn setup

# 2. Clone a Confluence space
cn clone <SPACE_KEY>

# 3. Pull pages as markdown
cd <SPACE_KEY>
cn pull
```

The space key is the identifier in your Confluence URL:
`https://yoursite.atlassian.net/wiki/spaces/<SPACE_KEY>/...`

Credentials are stored in `~/.cn/config.json`. Space configuration is saved to `.confluence.json` in the synced directory.

## Commands

| Command | Description |
|---------|-------------|
| `cn setup` | Configure Confluence credentials |
| `cn clone <SPACE_KEY>` | Clone a space to a new folder |
| `cn pull` | Pull changes from Confluence as markdown |
| `cn status` | Check connection and sync status |
| `cn tree` | Display page hierarchy |
| `cn open [page]` | Open page in browser |
| `cn doctor` | Health check for sync issues |
| `cn search <query>` | Search pages using CQL |
| `cn spaces` | List available spaces |
| `cn info <id\|file>` | Show page info and labels |
| `cn create <title>` | Create a new page |
| `cn delete <id>` | Delete a page |
| `cn comments <id\|file>` | Show page comments |
| `cn labels <id\|file>` | Manage page labels |
| `cn move <id\|file> <parentId>` | Move a page to a new parent |
| `cn attachments <id\|file>` | Manage page attachments |
| `cn folder <subcommand>` | Manage folders (create, list, delete, move) |

Run `cn <command> --help` for details on each command.

## Development

```bash
bun install
bun run cn --help
bun test
```

## License

MIT
