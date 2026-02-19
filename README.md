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
# Configure your Confluence credentials
cn setup

# Search pages
cn search "authentication"

# Open a page in the browser
cn open "Getting Started"

# Create a page
cn create "My Page" --space ENG

# List spaces
cn spaces
```

## Commands

| Command | Description |
|---------|-------------|
| `cn setup` | Configure Confluence credentials |
| `cn status` | Check connection and sync status |
| `cn tree` | Display page hierarchy |
| `cn open [page]` | Open page in browser |
| `cn doctor` | Health check for sync issues |
| `cn search <query>` | Search pages using CQL |
| `cn spaces` | List available spaces |
| `cn info <id\|file>` | Show page info and labels |
| `cn create <title>` | Create a new page (pipe content via stdin) |
| `cn update <id>` | Update an existing page (pipe content via stdin) |
| `cn delete <id>` | Delete a page |
| `cn comments <id\|file>` | Show page comments |
| `cn labels <id\|file>` | Manage page labels |
| `cn move <id\|file> <parentId>` | Move a page to a new parent |
| `cn attachments <id\|file>` | Manage page attachments |
| `cn folder <subcommand>` | Manage folders (create, list, delete, move) |
| `cn clone <SPACE_KEY>` | Clone a space to a new folder |
| `cn pull` | Pull changes from Confluence as markdown |

Run `cn <command> --help` for details on each command.

## Development

```bash
bun install
bun run cn --help
bun test
```

## See also

- [pchuri/confluence-cli](https://github.com/pchuri/confluence-cli)

## License

MIT
