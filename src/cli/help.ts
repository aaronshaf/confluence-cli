import chalk from 'chalk';

export function showSetupHelp(): void {
  console.log(`
${chalk.bold('cn setup - Configure Confluence credentials')}

${chalk.yellow('Usage:')}
  cn setup

${chalk.yellow('Description:')}
  Interactive setup wizard that configures:
  - Confluence Cloud URL (https://*.atlassian.net)
  - Email address
  - API token (create at https://id.atlassian.com/manage/api-tokens)

  Stores configuration securely in ~/.cn/config.json with 600 permissions.

${chalk.yellow('Options:')}
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn setup                  Start interactive setup
`);
}

export function showCloneHelp(): void {
  console.log(`
${chalk.bold('cn clone - Clone one or more Confluence spaces to new folders')}

${chalk.yellow('Usage:')}
  cn clone <SPACE_KEY> [SPACE_KEY...]

${chalk.yellow('Description:')}
  Creates new directories and initializes them for Confluence spaces.
  Similar to "git clone" - sets up everything needed to pull pages.
  Each space is cloned into a directory named after its space key.

${chalk.yellow('Arguments:')}
  SPACE_KEY                 One or more Confluence space keys (required)

${chalk.yellow('Options:')}
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn clone DOCS             Clone DOCS space to ./DOCS/
  cn clone ABC DEF GHI      Clone multiple spaces to ./ABC/, ./DEF/, ./GHI/
  cn clone ENG PROD TEST    Clone three spaces sequentially
`);
}

export function showPullHelp(): void {
  console.log(`
${chalk.bold('cn pull - Pull Confluence space to local folder')}

${chalk.yellow('Usage:')}
  cn pull [options]

${chalk.yellow('Description:')}
  Pulls pages from Confluence to the current directory.
  Must be run in a directory initialized with "cn clone".

${chalk.yellow('Modes:')}
  ${chalk.cyan('Smart pull (default)')}
    Only pulls pages that have changed since last pull.
    Compares version numbers to detect modifications.
    Handles renames and moves automatically.

  ${chalk.cyan('Full pull (--force)')}
    Re-downloads all pages regardless of local state.
    Use when local state may be corrupted or out of sync.

  ${chalk.cyan('Page-specific pull (--page)')}
    Force re-download specific pages regardless of version.
    Useful for re-converting pages after converter improvements.

${chalk.yellow('Options:')}
  --dry-run                 Show what would be pulled without making changes
  --force                   Full re-pull, ignore local state
  --page <path-or-id>       Force resync specific page (can use multiple times)
  --depth <n>               Limit depth
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn pull                             Smart pull (only changes)
  cn pull --dry-run                   Preview changes
  cn pull --force                     Full re-pull all pages
  cn pull --page ./docs/page.md       Force resync specific file
  cn pull --page 123456 --page 789    Force resync multiple pages by ID
`);
}

export function showStatusHelp(): void {
  console.log(`
${chalk.bold('cn status - Check connection and sync status')}

${chalk.yellow('Usage:')}
  cn status [options]

${chalk.yellow('Description:')}
  Shows the current configuration, connection status, and sync state.

${chalk.yellow('Options:')}
  --xml                     Output in XML format for LLM parsing
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn status                 Show status with colored output
  cn status --xml           Show status in XML format
`);
}

export function showTreeHelp(): void {
  console.log(`
${chalk.bold('cn tree - Display page hierarchy')}

${chalk.yellow('Usage:')}
  cn tree [space-key] [options]

${chalk.yellow('Description:')}
  Displays the page hierarchy for a space as an ASCII tree.
  If no space key is provided, uses the space in the current directory.

${chalk.yellow('Options:')}
  --remote                  Fetch live from API (default)
  --local                   Use cached sync state
  --depth <n>               Limit tree depth
  --xml                     Output in XML format for LLM parsing
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn tree                   Show tree for current directory's space
  cn tree DOCS              Show tree for DOCS space
  cn tree --depth 2         Limit to 2 levels deep
  cn tree --xml             Output in XML format
`);
}

export function showOpenHelp(): void {
  console.log(`
${chalk.bold('cn open - Open page in browser')}

${chalk.yellow('Usage:')}
  cn open [page]
  cn open [options]

${chalk.yellow('Description:')}
  Opens a Confluence page in your default browser.
  Without arguments, opens the space home page.

${chalk.yellow('Arguments:')}
  page                      Page title, file path, or page ID

${chalk.yellow('Options:')}
  --space <key>             Specify space key
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn open                   Open space home
  cn open "Getting Started" Open page by title
  cn open ./docs/page.md    Open page from local file
  cn open 123456789         Open page by ID
`);
}

export function showSpacesHelp(): void {
  console.log(`
${chalk.bold('cn spaces - List available Confluence spaces')}

${chalk.yellow('Usage:')}
  cn spaces [options]

${chalk.yellow('Options:')}
  --xml                     Output in XML format
  --help                    Show this help message
`);
}

export function showSearchHelp(): void {
  console.log(`
${chalk.bold('cn search - Search pages using CQL')}

${chalk.yellow('Usage:')}
  cn search <query> [options]

${chalk.yellow('Arguments:')}
  query                     Search query string (required)

${chalk.yellow('Options:')}
  --space <key>             Narrow search to a specific space
  --limit <n>               Maximum results (default: 10)
  --xml                     Output in XML format
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn search "authentication"
  cn search "api" --space DOCS
`);
}

export function showInfoHelp(): void {
  console.log(`
${chalk.bold('cn info - Show page info and labels')}

${chalk.yellow('Usage:')}
  cn info <id|file> [options]

${chalk.yellow('Arguments:')}
  id|file                   Page ID or path to local .md file

${chalk.yellow('Options:')}
  --xml                     Output in XML format
  --help                    Show this help message
`);
}

export function showCreateHelp(): void {
  console.log(`
${chalk.bold('cn create - Create a new Confluence page')}

${chalk.yellow('Usage:')}
  cn create <title> [options]
  echo "<p>Content</p>" | cn create <title> [options]

${chalk.yellow('Arguments:')}
  title                     Page title (required)

${chalk.yellow('Options:')}
  --space <key>             Space key (required if not in cloned dir)
  --parent <id>             Parent page ID
  --format <format>         Body format: storage (default), wiki, atlas_doc_format
  --open                    Open page in browser after creation
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn create "My Page" --space ENG
  echo "<p>Hello</p>" | cn create "My Page" --space ENG
  echo "h1. Hello" | cn create "Wiki Page" --space ENG --format wiki
`);
}

export function showUpdateHelp(): void {
  console.log(`
${chalk.bold('cn update - Update an existing Confluence page')}

${chalk.yellow('Usage:')}
  echo "<p>Content</p>" | cn update <id> [options]

${chalk.yellow('Arguments:')}
  id                        Page ID (required)

${chalk.yellow('Options:')}
  --format <format>         Body format: storage (default), wiki, atlas_doc_format
  --title <title>           New page title (default: keep existing title)
  --message <msg>           Version message
  --help                    Show this help message

${chalk.yellow('Examples:')}
  echo "<p>Updated content</p>" | cn update 123456
  echo "<p>New content</p>" | cn update 123456 --title "New Title"
  echo "h1. Hello" | cn update 123456 --format wiki --message "Updated via automation"
`);
}

export function showDeleteHelp(): void {
  console.log(`
${chalk.bold('cn delete - Delete a Confluence page')}

${chalk.yellow('Usage:')}
  cn delete <id> [options]

${chalk.yellow('Arguments:')}
  id                        Page ID (required)

${chalk.yellow('Options:')}
  --force                   Skip confirmation prompt
  --help                    Show this help message
`);
}

export function showCommentsHelp(): void {
  console.log(`
${chalk.bold('cn comments - Show footer comments for a page')}

${chalk.yellow('Usage:')}
  cn comments <id|file> [options]

${chalk.yellow('Arguments:')}
  id|file                   Page ID or path to local .md file

${chalk.yellow('Options:')}
  --xml                     Output in XML format
  --help                    Show this help message
`);
}

export function showLabelsHelp(): void {
  console.log(`
${chalk.bold('cn labels - Manage page labels')}

${chalk.yellow('Usage:')}
  cn labels <id|file> [options]

${chalk.yellow('Arguments:')}
  id|file                   Page ID or path to local .md file

${chalk.yellow('Options:')}
  --add <label>             Add a label
  --remove <label>          Remove a label
  --xml                     Output in XML format
  --help                    Show this help message
`);
}

export function showFolderHelp(): void {
  console.log(`
${chalk.bold('cn folder - Manage Confluence folders')}

${chalk.yellow('Usage:')}
  cn folder <subcommand> [options]

${chalk.yellow('Subcommands:')}
  create <title>            Create a new folder
  list                      List folders in a space
  delete <id>               Delete a folder
  move <id> <parentId>      Move a folder to a new parent

${chalk.yellow('Options:')}
  --space <key>             Space key (required for create/list if not in cloned dir)
  --parent <id>             Parent folder ID (for create)
  --force                   Skip confirmation prompt (for delete)
  --xml                     Output in XML format (for list)
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn folder create "My Folder" --space DOCS
  cn folder create "Nested" --space DOCS --parent 123456
  cn folder list --space DOCS
  cn folder delete 123456
  cn folder move 123456 789012
`);
}

export function showMoveHelp(): void {
  console.log(`
${chalk.bold('cn move - Move a page to a new parent')}

${chalk.yellow('Usage:')}
  cn move <id|file> <parentId>

${chalk.yellow('Arguments:')}
  id|file                   Page ID or path to local .md file
  parentId                  Target parent page ID

${chalk.yellow('Options:')}
  --help                    Show this help message
`);
}

export function showAttachmentsHelp(): void {
  console.log(`
${chalk.bold('cn attachments - Manage page attachments')}

${chalk.yellow('Usage:')}
  cn attachments <id|file> [options]

${chalk.yellow('Arguments:')}
  id|file                   Page ID or path to local .md file

${chalk.yellow('Options:')}
  --upload <file>           Upload a file as attachment
  --download <id>           Download an attachment by ID
  --delete <id>             Delete an attachment by ID
  --xml                     Output in XML format
  --help                    Show this help message
`);
}

export function showDoctorHelp(): void {
  console.log(`
${chalk.bold('cn doctor - Health check for synced spaces')}

${chalk.yellow('Usage:')}
  cn doctor [options]

${chalk.yellow('Description:')}
  Scans the current directory for common issues:
  - Duplicate page_ids (same page in multiple files)
  - Orphaned files (local files without Confluence pages)
  - Version mismatches

${chalk.yellow('Options:')}
  --fix                     Auto-fix issues (delete stale files)
  --xml                     Output in XML format for LLM parsing
  --help                    Show this help message

${chalk.yellow('Examples:')}
  cn doctor                 Run health check interactively
  cn doctor --fix           Auto-fix all detected issues
  cn doctor --xml           Output results in XML format
`);
}

export function showHelp(): void {
  console.log(`
${chalk.bold('cn - Confluence CLI')}

Sync Confluence spaces to local markdown files.

${chalk.yellow('Commands:')}
  cn setup                  Configure Confluence credentials
  cn clone                  Clone a space to a new folder
  cn pull                   Pull space to local folder
  cn folder                 Manage Confluence folders
  cn status                 Check connection and sync status
  cn tree                   Display page hierarchy
  cn open                   Open page in browser
  cn doctor                 Health check for sync issues
  cn search                 Search pages using CQL
  cn spaces                 List available spaces
  cn info                   Show page info and labels
  cn create                 Create a new page
  cn update                 Update an existing page
  cn delete                 Delete a page
  cn comments               Show page comments
  cn labels                 Manage page labels
  cn move                   Move a page to a new parent
  cn attachments            Manage page attachments

${chalk.yellow('Global Options:')}
  --help, -h                Show help message
  --version, -v             Show version number
  --verbose                 Enable verbose output
  --xml                     Output in XML format (where supported)

${chalk.yellow('Environment Variables:')}
  CN_CONFIG_PATH            Override config file location
  CN_DEBUG                  Enable debug logging
  NO_COLOR                  Disable colored output

${chalk.yellow('Examples:')}
  cn setup                  Configure credentials
  cn clone DOCS             Clone DOCS space to ./DOCS
  cn pull                   Pull changes
  cn tree                   Show page hierarchy
  cn open "My Page"         Open page in browser

${chalk.gray('For more information on a command, run: cn <command> --help')}
${chalk.gray('Confluence REST API reference: https://docs.atlassian.com/atlassian-confluence/REST/6.6.0/')}
`);
}
