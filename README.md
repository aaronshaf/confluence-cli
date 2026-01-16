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

# 2. Clone a Confluence space
cn clone <SPACE_KEY>

# 3. Pull the pages
cd <SPACE_KEY>
cn pull
```

The space key is the identifier in your Confluence URL:
`https://yoursite.atlassian.net/wiki/spaces/<SPACE_KEY>/...`

Credentials are stored in `~/.cn/config.json`. Space configuration is saved to `.confluence.json` in the synced directory.

## Usage

```bash
# Clone a space to a new directory
cn clone DOCS

# Pull changes from Confluence
cn pull

# Pull specific pages only
cn pull --page ./path/to/page.md

# Push a single file to Confluence
cn push ./path/to/page.md

# Push changed files (prompts for each)
cn push

# Push with dry run (preview without changes)
cn push --dry-run

# Force push (overwrite remote changes)
cn push ./path/to/page.md --force

# Check connection status
cn status

# View page hierarchy
cn tree

# Open page in browser
cn open

# Search local content (requires Meilisearch)
cn search "query"
cn search "api" --labels documentation
cn search index
cn search status
```

## Search

Search requires [Meilisearch](https://www.meilisearch.com/) running locally:

```bash
# Start Meilisearch
docker run -d -p 7700:7700 getmeili/meilisearch:latest

# Build the search index
cn search index

# Search
cn search "authentication"
cn search "api" --labels documentation --limit 5
```

## Requirements

- Bun 1.2.0+
- Confluence Cloud account
- Meilisearch (optional, for search)

## Development

```bash
bun install
bun run cn --help
bun test
```

## License

MIT
