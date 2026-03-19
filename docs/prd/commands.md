# cn - Commands Specification

## Global Options

```
--help, -h     Show help
--version, -v  Show version
--verbose      Enable verbose output
--xml          Output in XML format (LLM-friendly)
```

---

## cn setup

Interactive configuration wizard for first-time setup.

### Usage

```
cn setup
```

### Flow

1. Prompt for Confluence URL
2. Prompt for email
3. Prompt for API token (hidden input)
4. Verify connection by calling `/wiki/api/v2/spaces?limit=1`
5. Save to `~/.cn/config.json` with 600 permissions

### Example

```
$ cn setup
? Confluence URL: https://company.atlassian.net
? Email: user@example.com
? API Token: ****
✓ Connection verified
✓ Configuration saved to ~/.cn/config.json
```

### Errors

- Invalid URL format
- Invalid email format
- Connection failed (network error)
- Authentication failed (401)
- Permission denied (403)

---

## cn clone

Clone a Confluence space to a new local directory.

### Usage

```
cn clone <SPACE_KEY> [directory]
```

### Arguments

- `SPACE_KEY` - The Confluence space key (required)
- `directory` - Target directory name (defaults to space key)

### Behavior

1. Verify space exists via API
2. Create target directory
3. Create `.confluence.json` with space metadata
4. Print instructions to run `cn pull`

### Example

```
$ cn clone ENG
✓ Cloned space "Engineering" (ENG) into ENG

  cd ENG
  cn pull

$ cn clone ENG my-engineering
✓ Cloned space "Engineering" (ENG) into my-engineering

  cd my-engineering
  cn pull
```

### Errors

- Space not found
- Directory already exists
- Permission denied

---

## cn pull

Pull pages from Confluence to the current directory.

### Usage

```
cn pull [options]
```

### Options

```
--dry-run             Show what would be pulled without making changes
--force               Full re-pull (re-download all pages)
--page <path-or-id>   Force resync specific page (can use multiple times)
--depth <n>           Limit pull depth (default: unlimited)
```

### Pull Modes

**Smart Pull (default):**
- Only pulls pages where remote version > local version
- Handles title/parent changes by moving local files
- Most efficient for regular use

**Full Pull (`--force`):**
- Re-downloads all pages regardless of local state
- Deletes all existing tracked files first
- Use when local state may be corrupted

**Page-specific Pull (`--page`):**
- Force re-download specific pages regardless of version
- Accepts local file paths or Confluence page IDs
- Useful for re-converting pages after converter improvements
- Can specify multiple pages: `--page file1.md --page file2.md`

### Behavior

**Smart Pull (default):**
1. Read `.confluence.json` from current directory
2. Compare remote versions with local sync state
3. Download new/modified pages
4. Move files if title/parent changed
5. Remove deleted pages
6. Update sync state

**Full Pull (`--force`):**
1. Read `.confluence.json` from current directory
2. Delete all tracked files
3. Re-download all pages
4. Update sync state

### Output

```
$ cn pull
Pulling space: Engineering (ENG)
⠋ Fetching pages from Confluence...
  Found 42 pages and 3 folders
  3 new, 2 modified, 1 deleted

  ✓ getting-started/installation.md
  ✓ getting-started/quick-start.md
  ✓ api-reference/endpoints.md
  ✓ api-reference/auth.md
  ✓ getting-started/config.md
  ✓ deprecated/old-page.md (deleted)

✓ Pull complete: 5 added, 1 deleted
```

### File Naming

1. Slugify page title: "Getting Started" → "getting-started"
2. Use `README.md` for pages with children
3. Append counter for conflicts: `page.md`, `page-2.md`

### Example Directory Structure

```
./
├── .confluence.json
├── README.md                    # Space homepage
├── getting-started/
│   ├── README.md                # "Getting Started" page (has children)
│   └── installation.md
└── api-reference/
    ├── README.md
    └── endpoints.md
```

---

## cn status

Check connection status and sync information.

### Usage

```
cn status
```

### Output (No Config)

```
$ cn status
✗ Not configured. Run 'cn setup' first.
```

### Output (Not in Sync Folder)

```
$ cn status
✓ Connected to https://company.atlassian.net
✗ No .confluence.json found. Run 'cn clone <SPACE_KEY>' to clone a space.
```

### Output (In Sync Folder)

```
$ cn status
✓ Connected to https://company.atlassian.net
Space: Engineering (ENG)
  Last sync: 2024-01-15 10:30:00
  Local pages: 42
  Remote pages: 44
  Pending changes: 2 new, 1 modified
```

### XML Output

```
$ cn status --xml
<confluence-status>
  <connection status="connected" url="https://company.atlassian.net"/>
  <space key="ENG" name="Engineering" id="123456"/>
  <sync>
    <last-sync>2024-01-15T10:30:00Z</last-sync>
    <local-pages>42</local-pages>
    <remote-pages>44</remote-pages>
    <pending added="2" modified="1" deleted="0"/>
  </sync>
</confluence-status>
```

---

## cn tree

Display the page hierarchy of a space.

### Usage

```
cn tree [SPACE_KEY]
cn tree [options]
```

### Options

```
--remote    Show remote tree (from Confluence API)
--local     Show local tree (from .confluence.json) [default]
--depth <n> Limit tree depth
--xml       Output as XML (inherited from global)
```

### Output

```
$ cn tree ENG
Engineering (ENG)
├── Home
├── Getting Started
│   ├── Installation
│   ├── Quick Start
│   └── Configuration
├── API Reference
│   ├── Authentication
│   └── Endpoints
└── FAQ
```

### XML Output

```xml
$ cn tree ENG --xml
<page-tree space="ENG" name="Engineering">
  <page id="1" title="Home" depth="0">
    <page id="2" title="Getting Started" depth="1">
      <page id="3" title="Installation" depth="2"/>
      <page id="4" title="Quick Start" depth="2"/>
      <page id="5" title="Configuration" depth="2"/>
    </page>
    <page id="6" title="API Reference" depth="1">
      <page id="7" title="Authentication" depth="2"/>
      <page id="8" title="Endpoints" depth="2"/>
    </page>
    <page id="9" title="FAQ" depth="1"/>
  </page>
</page-tree>
```

### Behavior

- Without arguments: show tree for current directory's space
- With space key: show tree for specified space
- `--remote` fetches live from API
- `--local` uses cached sync state

---

## cn open

Open a page in the default browser.

### Usage

```
cn open [PAGE]
cn open [options]
```

### Options

```
--space <key>  Specify space (default: current directory's space)
```

### Arguments

- No argument: open space home page
- Page title: open matching page
- Page ID: open specific page
- Path: open page at local path

### Examples

```
# Open space home
$ cn open

# Open by title (fuzzy match)
$ cn open "Getting Started"

# Open by local file path
$ cn open ./getting-started/installation.md

# Open by page ID
$ cn open 123456
```

### Behavior

1. Resolve page to Confluence URL
2. Open URL in default browser using `open` (macOS) / `xdg-open` (Linux)

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error (not configured) |
| 3 | Authentication error |
| 4 | Network error |
| 5 | Space not found |
| 6 | Invalid arguments |
| 7 | Page not found |
| 8 | Version conflict |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CN_CONFIG_PATH` | Override config file location |
| `CN_DEBUG` | Enable debug logging |
| `NO_COLOR` | Disable colored output |

---

## cn doctor

Health check for synced spaces.

```
cn doctor [options]
```

**Options:**
- `--fix` - Auto-fix issues (delete stale files)
- `--xml` - Output in XML format
- `--help` - Show help

**Checks:**
- Duplicate page_ids (same page in multiple files)
- Orphaned files (local files without Confluence pages)
- Version mismatches

---

## cn search

Search pages using Confluence CQL.

```
cn search <cql> [options]
```

**Arguments:**
- `cql` - Confluence Query Language expression (required)

**Options:**
- `--limit <n>` - Maximum results (default: 10)
- `--xml` - Output in XML format
- `--help` - Show help

**Examples:**
```bash
cn search 'type=page AND text~"authentication"'
cn search 'type=page AND space=DOCS AND text~"api"'
cn search 'type=page AND lastModified >= "2026-01-01"'
cn search 'type=page AND label=draft AND space=ENG' --limit 5
```

---

## cn spaces

List available Confluence spaces.

```
cn spaces [options]
```

**Options:**
- `--limit <n>` - Number of spaces per page (default: 25)
- `--page <n>` - Page number for pagination
- `--xml` - Output in XML format
- `--help` - Show help

**Examples:**
```bash
cn spaces
cn spaces --limit 50
cn spaces --page 2
cn spaces --page 2 --limit 10
```

---

## cn info

Show info and labels for a page.

```
cn info <id|file> [options]
```

**Arguments:**
- `id|file` - Page ID, or path to local markdown file

**Options:**
- `--xml` - Output in XML format
- `--help` - Show help

**Examples:**
```bash
cn info 123456
cn info ./docs/my-page.md
```

---

## cn create

Create a new Confluence page.

```
cn create <title> [options]
```

**Arguments:**
- `title` - Page title (required)

**Options:**
- `--space <key>` - Space key (required if not in cloned dir)
- `--parent <id>` - Parent page ID
- `--open` - Open page in browser after creation
- `--help` - Show help

**Examples:**
```bash
cn create "My New Page" --space DOCS
cn create "Child Page" --parent 123456
```

---

## cn delete

Delete a Confluence page.

```
cn delete <id> [options]
```

**Arguments:**
- `id` - Page ID (required)

**Options:**
- `--force` - Skip confirmation prompt
- `--help` - Show help

**Examples:**
```bash
cn delete 123456
cn delete 123456 --force
```

---

## cn comments

Show footer comments for a page.

```
cn comments <id|file> [options]
```

**Arguments:**
- `id|file` - Page ID, or path to local markdown file

**Options:**
- `--xml` - Output in XML format
- `--help` - Show help

---

## cn labels

List and manage labels for a page.

```
cn labels <id|file> [options]
```

**Arguments:**
- `id|file` - Page ID, or path to local markdown file

**Options:**
- `--add <label>` - Add a label
- `--remove <label>` - Remove a label
- `--xml` - Output in XML format
- `--help` - Show help

**Examples:**
```bash
cn labels ./docs/my-page.md
cn labels 123456 --add documentation
cn labels 123456 --remove draft
```

---

## cn move

Move a page to a new parent.

```
cn move <id|file> <parentId> [options]
```

**Arguments:**
- `id|file` - Page ID or path to local markdown file
- `parentId` - Target parent page ID

**Options:**
- `--help` - Show help

**Examples:**
```bash
cn move 123456 789012
cn move ./docs/my-page.md 789012
```

---

## cn attachments

Manage attachments for a page.

```
cn attachments <id|file> [options]
```

**Arguments:**
- `id|file` - Page ID, or path to local markdown file

**Options:**
- `--upload <file>` - Upload a file as attachment
- `--download <id>` - Download an attachment by ID
- `--delete <id>` - Delete an attachment by ID
- `--help` - Show help

**Examples:**
```bash
cn attachments 123456
cn attachments 123456 --upload ./image.png
cn attachments 123456 --download att-789
cn attachments 123456 --delete att-789
```

---

## cn update

Update an existing Confluence page body via stdin.

### Usage

```
echo "<p>Content</p>" | cn update <id> [options]
```

### Arguments

- `id` - Page ID (required)

### Options

- `--format <format>` - Body format: `storage` (default), `wiki`, `atlas_doc_format`
- `--title <title>` - New page title (default: keep existing title)
- `--message <msg>` - Version message
- `--help` - Show help

### Behavior

1. Read body content from stdin (required)
2. Fetch current page to get version number and existing title
3. Update page via API with incremented version
4. Print confirmation with URL

### Examples

```bash
echo "<p>Updated content</p>" | cn update 123456
echo "<p>New content</p>" | cn update 123456 --title "New Title"
echo "h1. Hello" | cn update 123456 --format wiki --message "Updated via automation"
```

---

## cn folder

Manage Confluence folders (a special content type for organizing pages).

### Usage

```
cn folder <subcommand> [options]
```

### Subcommands

- `create <title>` - Create a new folder
- `list` - List folders in a space
- `delete <id>` - Delete a folder
- `move <id> <parentId>` - Move a folder to a new parent

### Options

- `--space <key>` - Space key (required for create/list if not in cloned dir)
- `--parent <id>` - Parent folder ID (for create)
- `--force` - Skip confirmation prompt (for delete)
- `--xml` - Output in XML format (for list)
- `--help` - Show help

### Examples

```bash
cn folder create "My Folder" --space DOCS
cn folder create "Nested" --space DOCS --parent 123456
cn folder list --space DOCS
cn folder list --space DOCS --xml
cn folder delete 123456
cn folder delete 123456 --force
cn folder move 123456 789012
```

---

## cn read

Read a single page's body content and output it to stdout as markdown.

### Motivation

All other content-retrieval commands (`pull`, `clone`) require a cloned space directory and write to disk. `cn info` only returns metadata. `cn search` only returns excerpts. There is no way to quickly read a single page's full body content to stdout. This is a gap for:

- **Agent/LLM workflows**: Agents need to read page content without setting up a local clone.
- **Quick lookups**: Pipe page content to other tools without side effects on disk.
- **Scripting**: Compose `cn search` then `cn read` pipelines.

### Usage

```
cn read <id|file> [options]
```

### Arguments

- `id|file` - Page ID or path to local markdown file (required)

### Options

```
--xml       Output in XML format (body wrapped in <content> tags)
--html      Output raw Confluence storage format HTML instead of markdown
```

### Behavior

1. Resolve page target (ID or local file path)
2. Fetch page with body content via API (`getPage(id, true)`)
3. Convert HTML storage format to markdown (using Turndown)
4. Print markdown to stdout

### Output

```
$ cn read 123456
# Getting Started

Welcome to our documentation. This guide covers...
```

### XML Output

```xml
$ cn read 123456 --xml
<page>
  <id>123456</id>
  <title>Getting Started</title>
  <content>
# Getting Started

Welcome to our documentation. This guide covers...
  </content>
</page>
```

### HTML Output

```
$ cn read 123456 --html
<h1>Getting Started</h1>
<p>Welcome to our documentation. This guide covers...</p>
```

### Notes

- Does not require a cloned space directory or `.confluence.json`
- Only requires `~/.cn/config.json` (same as `cn info`, `cn search`)
- No side effects on disk

---

## Future Commands (Planned)

| Command | Description |
|---------|-------------|
| `cn diff` | Show differences between local and remote |
| `cn watch` | Watch for remote changes |

