---
name: cn
description: Use the cn CLI to interact with Confluence. Search pages, read content, create/update/delete pages, manage labels, move pages, check sync status, and more. Use when user wants to work with Confluence pages via cn CLI.
---

# cn - Confluence CLI Skill

Use the `cn` CLI to interact with Confluence spaces and pages.

## Scope

Only use `cn` commands. Do not reach for `kb`, MCP tools, or other search tools — if the user wanted those they would ask for them explicitly.

## Config

Credentials stored at `~/.cn/config.json`:
```json
{
  "confluenceUrl": "https://company.atlassian.net",
  "email": "user@company.com",
  "apiToken": "..."
}
```

Run `cn setup` to configure interactively.

## Commands Reference

### Search

```bash
cn search "<query>"                  # Search all spaces
cn search "<query>" --space ENG      # Narrow to a space
cn search "<query>" --limit 20       # More results (default: 10)
cn search "<query>" --xml            # XML output for parsing
```

Search uses Confluence CQL under the hood. The query is a free-text string; the CLI wraps it in a `text ~ "..."` CQL expression scoped to `type = page`.

### Browse & Explore

```bash
cn spaces                            # List spaces (first 25)
cn spaces --limit 50                 # More spaces
cn spaces --page 2                   # Next page of results
cn spaces --page 2 --limit 10        # Custom page size
cn spaces --xml                      # XML output for parsing

cn tree                              # Show page hierarchy (current dir)
cn tree ENG                          # Show tree for a specific space
cn tree --depth 2                    # Limit to 2 levels deep
cn tree --xml                        # XML output for parsing

cn info <page_id>                    # Show page info, labels, version
cn info ./docs/my-page.md            # Info from local synced file
cn info 123456 --xml                 # XML output

cn comments <page_id>                # Show footer comments
cn comments ./docs/my-page.md        # Comments from local file
cn comments 123456 --xml

cn attachments <page_id>             # List attachments
cn attachments ./docs/my-page.md
cn attachments 123456 --xml
```

### Open in Browser

**WARNING:** `cn open` launches a web browser window. Do NOT use in non-interactive
environments (CI, bots, agents). Use `cn info` or `cn search` instead to get page URLs.

```bash
cn open                              # Open space home in web browser
cn open "Getting Started"            # Open by title in web browser
cn open 123456                       # Open by page ID in web browser
cn open ./docs/my-page.md            # Open from local path in web browser
```

### Clone & Sync

```bash
cn clone ENG                         # Clone space to ./ENG
cn clone ENG my-folder               # Clone to custom directory
cn clone ABC DEF GHI                 # Clone multiple spaces

cn pull                              # Smart pull (new/modified only)
cn pull --force                      # Full re-pull all pages
cn pull --dry-run                    # Preview what would change
cn pull --page ./docs/my-page.md     # Re-sync specific page by path
cn pull --page 123456                # Re-sync specific page by ID
cn pull --page 123456 --page 789012  # Re-sync multiple pages

cn status                            # Check connection and sync state
cn status --xml                      # XML output
```

Smart pull compares version numbers to detect modifications and handles renames and moves automatically.

### Create & Update Pages

```bash
cn create "Page Title" --space ENG                        # Create blank page
cn create "Page Title" --space ENG --open                 # Create and open in browser
cn create "Child Page" --parent 123456                    # Create under parent
echo "<p>Hello</p>" | cn create "Page Title" --space ENG  # Create with storage HTML body
echo "h1. Hello" | cn create "Wiki Page" --space ENG --format wiki  # Wiki markup
cn update 123456                                          # ERROR: requires stdin
echo "<p>Updated</p>" | cn update 123456                  # Update page body
echo "<p>New</p>" | cn update 123456 --title "New Title"  # Update body and title
echo "h1. Content" | cn update 123456 --format wiki       # Update with wiki markup
echo "<p>x</p>" | cn update 123456 --message "via bot"    # With version message
```

Valid `--format` values: `storage` (default), `wiki`, `atlas_doc_format`

The `storage` format is Confluence's XHTML-based storage format. When piping content:
- For `storage`: pipe valid XHTML (`<p>`, `<h1>`, `<ul>`, etc.)
- For `wiki`: pipe Confluence wiki markup (`h1.`, `*bold*`, `- item`, etc.)

### Delete & Move Pages

```bash
cn delete 123456                             # Delete (prompts confirmation)
cn delete 123456 --force                     # Delete without prompt

cn move 123456 789012                        # Move page to new parent
cn move ./docs/my-page.md 789012             # Move from local path
```

### Labels

```bash
cn labels 123456                     # List labels
cn labels ./docs/my-page.md          # Labels from local path
cn labels 123456 --add documentation # Add label
cn labels 123456 --remove draft      # Remove label
cn labels 123456 --xml               # XML output
```

### Attachments

```bash
cn attachments 123456                        # List attachments
cn attachments 123456 --upload ./image.png   # Upload file
cn attachments 123456 --download att-789     # Download attachment
cn attachments 123456 --delete att-789       # Delete attachment
cn attachments 123456 --xml                  # XML output
```

### Folders

Confluence folders are a special content type for organizing pages.

```bash
cn folder create "My Folder" --space DOCS          # Create folder in space root
cn folder create "Nested" --space DOCS --parent 123456  # Create under parent
cn folder list --space DOCS                        # List folders
cn folder list --space DOCS --xml
cn folder delete 123456                            # Delete folder (prompts)
cn folder delete 123456 --force                    # Delete without prompt
cn folder move 123456 789012                       # Move folder to new parent
```

### Health Check

```bash
cn doctor                            # Detect sync issues
cn doctor --fix                      # Auto-fix issues (deletes stale files)
cn doctor --xml                      # XML output
```

Doctor checks for: duplicate page_ids, orphaned local files, version mismatches.

## Global Options

```bash
--xml        # Output in XML format (useful for parsing/LLM consumption)
--verbose    # Enable verbose output
--help, -h   # Show help
--version    # Show version
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CN_CONFIG_PATH` | Override default config file location |
| `CN_DEBUG=1` | Enable verbose debug logging to stderr (shows all HTTP requests) |
| `NO_COLOR` | Disable colored output |

## XML Output

Many commands support `--xml` for structured output that's easier to parse:

```bash
cn search "api" --xml
cn status --xml
cn tree --xml
cn info 123456 --xml
cn spaces --xml
cn labels 123456 --xml
cn comments 123456 --xml
cn attachments 123456 --xml
cn doctor --xml
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Not configured |
| 3 | Auth error |
| 4 | Network error |
| 5 | Space not found |
| 6 | Invalid arguments |
| 7 | Page not found |
| 8 | Version conflict |

## Data Model

Local synced pages are markdown files with YAML frontmatter:

```markdown
---
page_id: "123456"
title: My Page
space_key: ENG
version: 5
synced_at: 2024-01-15T10:30:00Z
parent_id: "100000"
child_count: 3
labels:
  - documentation
  - api
---

# My Page

Page content here...
```

The `.confluence.json` file in each cloned directory tracks space config and sync state. The `page_id` in frontmatter is the source of truth for which Confluence page a local file maps to.

## Common Workflows

### Find and read a page

```bash
cn search "topic" --xml              # Find pages, get IDs
cn info <page_id>                    # Check page details, labels, version
```

### Create a page with content

```bash
echo "<p>Hello world</p>" | cn create "New Page" --space ENG
echo "<p>Child content</p>" | cn create "Child Page" --parent 123456
```

### Update a page

```bash
echo "<p>Updated content</p>" | cn update 123456
echo "<p>New body</p>" | cn update 123456 --title "Renamed Title" --message "Updated via bot"
```

### Clone and explore a space

```bash
cn clone ENG && cd ENG
cn pull
cn tree
```

### Add labels to a page

```bash
cn labels 123456 --add reviewed --add published
cn labels 123456 --remove draft
```

### Work with page hierarchy

```bash
cn tree ENG --xml                    # Get full hierarchy with IDs
cn move 123456 789012                # Reparent a page
cn create "New Section" --parent 789012 --space ENG
```

## Tips

- Use `--xml` output when you need to parse results or pass to another command
- Page IDs are stable — prefer them over titles when scripting
- `cn search` supports CQL — queries like `cn search "space = ENG AND label = draft"` work
- For new pages, pipe storage format HTML for full control over formatting
- Pages with children become `README.md` files in subdirectories when cloned
- Run `cn doctor` if sync seems out of sync after manual changes
- `cn pull --dry-run` before a full pull to preview what will change
- `CN_DEBUG=1 cn <command>` logs every HTTP request to stderr for troubleshooting

## Reference

Confluence REST API reference: https://docs.atlassian.com/atlassian-confluence/REST/6.6.0/
