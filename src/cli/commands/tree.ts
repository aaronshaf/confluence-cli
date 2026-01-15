import chalk from 'chalk';
import ora from 'ora';
import { ConfluenceClient, type Page, type PageTreeNode } from '../../lib/confluence-client/index.js';
import { ConfigManager } from '../../lib/config.js';
import { EXIT_CODES } from '../../lib/errors.js';
import { getFormatter, type TreeNode } from '../../lib/formatters.js';
import { readSpaceConfig } from '../../lib/space-config.js';
import { SyncEngine } from '../../lib/sync/index.js';

export interface TreeCommandOptions {
  spaceKey?: string;
  remote?: boolean;
  depth?: number;
  xml?: boolean;
}

/**
 * Convert PageTreeNode to TreeNode format for formatter
 */
function convertToTreeNode(node: PageTreeNode, maxDepth?: number, currentDepth = 0): TreeNode {
  const shouldIncludeChildren = maxDepth === undefined || currentDepth < maxDepth;

  return {
    id: node.page.id,
    title: node.page.title,
    children: shouldIncludeChildren
      ? node.children.map((child) => convertToTreeNode(child, maxDepth, currentDepth + 1))
      : [],
  };
}

/**
 * Build tree from flat page list
 */
function buildTree(pages: Page[]): PageTreeNode[] {
  const pageMap = new Map<string, PageTreeNode>();
  const roots: PageTreeNode[] = [];

  // Create nodes for all pages
  for (const page of pages) {
    pageMap.set(page.id, { page, children: [] });
  }

  // Build tree structure
  for (const page of pages) {
    const node = pageMap.get(page.id);
    if (!node) continue;
    if (page.parentId && pageMap.has(page.parentId)) {
      pageMap.get(page.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children alphabetically
  const sortChildren = (nodes: PageTreeNode[]): void => {
    nodes.sort((a, b) => a.page.title.localeCompare(b.page.title));
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

/**
 * Tree command - displays page hierarchy
 */
export async function treeCommand(options: TreeCommandOptions = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.getConfig();
  const formatter = getFormatter(options.xml || false);

  if (!config) {
    console.error(chalk.red('Not configured. Please run "cn setup" first.'));
    process.exit(EXIT_CODES.CONFIG_ERROR);
  }

  const directory = process.cwd();
  let spaceId: string | undefined;
  let spaceKey: string | undefined;

  // Determine space to use
  if (options.spaceKey) {
    // Get space by key
    const spinner = options.xml ? null : ora(`Fetching space ${options.spaceKey}...`).start();

    try {
      const client = new ConfluenceClient(config);
      const space = await client.getSpaceByKey(options.spaceKey);
      spaceId = space.id;
      spaceKey = space.key;
      spinner?.succeed(`Found space: ${space.name}`);
    } catch (_error) {
      spinner?.fail(`Space "${options.spaceKey}" not found`);
      process.exit(EXIT_CODES.SPACE_NOT_FOUND);
    }
  } else {
    // Use space from current directory
    const spaceConfig = readSpaceConfig(directory);
    if (!spaceConfig) {
      console.error(chalk.red('No space configured in this directory.'));
      console.log(chalk.gray('Specify a space key or run "cn sync --init <SPACE_KEY>" first.'));
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }
    spaceId = spaceConfig.spaceId;
    spaceKey = spaceConfig.spaceKey;
  }

  // Fetch pages
  const spinner = options.xml ? null : ora('Fetching page tree...').start();

  try {
    let pages: Page[];

    if (options.remote !== false) {
      // Fetch from API
      if (!spaceId) {
        spinner?.fail('Space ID not available');
        process.exit(EXIT_CODES.CONFIG_ERROR);
      }
      const syncEngine = new SyncEngine(config);
      pages = await syncEngine.fetchPageTree(spaceId);
    } else {
      // Use local cache
      const spaceConfig = readSpaceConfig(directory);
      if (!spaceConfig) {
        spinner?.fail('No local sync state found. Use --remote to fetch from API.');
        process.exit(EXIT_CODES.CONFIG_ERROR);
      }

      // Build pages from sync state, inferring hierarchy from file paths
      // Create a map of directory paths to page IDs for parent lookup
      const pathToPageId = new Map<string, string>();
      for (const info of Object.values(spaceConfig.pages)) {
        // For index.md files, map the parent directory
        if (info.localPath.endsWith('/index.md')) {
          const dir = info.localPath.replace('/index.md', '');
          pathToPageId.set(dir, info.pageId);
        }
      }

      pages = Object.values(spaceConfig.pages).map((info) => {
        // Extract title from filename
        const filename = info.localPath.split('/').pop() || '';
        const title = filename.replace('.md', '').replace('index', '') || info.pageId;

        // Infer parent from path structure
        const pathParts = info.localPath.split('/');
        let parentId: string | null = null;

        if (pathParts.length > 1) {
          // For regular files, parent is the directory's index.md
          // For index.md, parent is the grandparent directory's index.md
          const parentDir = info.localPath.endsWith('/index.md')
            ? pathParts.slice(0, -2).join('/')
            : pathParts.slice(0, -1).join('/');

          if (parentDir) {
            parentId = pathToPageId.get(parentDir) || null;
          }
        }

        return {
          id: info.pageId,
          title: title || info.localPath,
          spaceId: spaceConfig.spaceId,
          parentId,
        };
      });
    }

    spinner?.succeed(`Found ${pages.length} pages`);

    // Build tree
    const tree = buildTree(pages);
    const treeNodes = tree.map((node) => convertToTreeNode(node, options.depth));

    // Output tree
    console.log('');
    console.log(options.xml ? '' : chalk.bold(`${spaceKey}:`));
    console.log(formatter.formatTree(treeNodes));
  } catch (error) {
    spinner?.fail('Failed to fetch page tree');
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}
