import { describe, expect, test } from 'bun:test';
import {
  buildPageLookupMapFromCache,
  confluenceLinkToRelativePath,
  extractPageTitleFromLink,
  relativePathToConfluenceLink,
  type PageLookupMap,
} from '../lib/markdown/link-converter.js';
import type { PageStateCache, FullPageInfo } from '../lib/page-state.js';

/**
 * Helper to create PageStateCache from a simple record
 * Simplifies test setup by avoiding need to create actual files
 */
function createPageStateCache(
  pages: Record<string, { pageId: string; localPath: string; title: string; version?: number }>,
): PageStateCache {
  const pagesMap = new Map<string, FullPageInfo>();
  const pathToPageId = new Map<string, string>();

  for (const [pageId, info] of Object.entries(pages)) {
    pagesMap.set(pageId, {
      pageId: info.pageId,
      localPath: info.localPath,
      title: info.title,
      version: info.version ?? 1,
    });
    pathToPageId.set(info.localPath, pageId);
  }

  return { pages: pagesMap, pathToPageId };
}

describe('buildPageLookupMapFromCache', () => {
  test('builds lookup maps from PageStateCache', () => {
    const pageState = createPageStateCache({
      'page-1': {
        pageId: 'page-1',
        localPath: 'getting-started.md',
        title: 'Getting Started',
      },
      'page-2': {
        pageId: 'page-2',
        localPath: 'architecture/overview.md',
        title: 'Architecture Overview',
      },
    });

    const lookupMap = buildPageLookupMapFromCache(pageState);

    expect(lookupMap.idToPage.get('page-1')?.localPath).toBe('getting-started.md');
    expect(lookupMap.idToPage.get('page-2')?.localPath).toBe('architecture/overview.md');
    expect(lookupMap.titleToPage.get('Getting Started')?.pageId).toBe('page-1');
    expect(lookupMap.titleToPage.get('Architecture Overview')?.pageId).toBe('page-2');
    expect(lookupMap.pathToPage.get('getting-started.md')?.pageId).toBe('page-1');
    expect(lookupMap.pathToPage.get('architecture/overview.md')?.pageId).toBe('page-2');
  });

  test('handles duplicate titles (deterministic ordering)', () => {
    const pageState = createPageStateCache({
      'page-2': {
        pageId: 'page-2',
        localPath: 'architecture/overview.md',
        title: 'Overview',
      },
      'page-1': {
        pageId: 'page-1',
        localPath: 'overview.md',
        title: 'Overview',
      },
    });

    const lookupMap = buildPageLookupMapFromCache(pageState);

    // Page with lexicographically smallest pageId should win (page-1 < page-2)
    expect(lookupMap.titleToPage.get('Overview')?.pageId).toBe('page-1');
  });

  test('warns about duplicate titles when enabled', () => {
    const pageState = createPageStateCache({
      'page-2': {
        pageId: 'page-2',
        localPath: 'architecture/overview.md',
        title: 'Overview',
      },
      'page-1': {
        pageId: 'page-1',
        localPath: 'overview.md',
        title: 'Overview',
      },
    });

    // Capture console.warn calls
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    try {
      buildPageLookupMapFromCache(pageState, true);

      // Should have warned about duplicate
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('Duplicate page title "Overview"');
      expect(warnings[0]).toContain('overview.md');
      expect(warnings[0]).toContain('architecture/overview.md');
      // Verify it indicates page-1 will be used (lexicographically smallest)
      expect(warnings[0]).toContain('overview.md');
    } finally {
      console.warn = originalWarn;
    }
  });

  test('handles empty PageStateCache', () => {
    const pageState: PageStateCache = {
      pages: new Map(),
      pathToPageId: new Map(),
    };

    const lookupMap = buildPageLookupMapFromCache(pageState);

    expect(lookupMap.idToPage.size).toBe(0);
    expect(lookupMap.titleToPage.size).toBe(0);
    expect(lookupMap.pathToPage.size).toBe(0);
  });
});

describe('confluenceLinkToRelativePath', () => {
  let lookupMap: PageLookupMap;

  const pageState = createPageStateCache({
    'page-1': {
      pageId: 'page-1',
      localPath: 'getting-started.md',
      title: 'Getting Started',
    },
    'page-2': {
      pageId: 'page-2',
      localPath: 'architecture/overview.md',
      title: 'Architecture Overview',
    },
    'page-3': {
      pageId: 'page-3',
      localPath: 'architecture/database.md',
      title: 'Database Design',
    },
  });

  test('converts Confluence link to relative path (same directory)', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = confluenceLinkToRelativePath('Architecture Overview', 'architecture/database.md', lookupMap);

    expect(result).toBe('./overview.md');
  });

  test('converts Confluence link to relative path (parent directory)', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = confluenceLinkToRelativePath('Getting Started', 'architecture/database.md', lookupMap);

    expect(result).toBe('../getting-started.md');
  });

  test('converts Confluence link to relative path (child directory)', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = confluenceLinkToRelativePath('Architecture Overview', 'getting-started.md', lookupMap);

    expect(result).toBe('./architecture/overview.md');
  });

  test('returns null for non-existent page', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = confluenceLinkToRelativePath('Non Existent Page', 'getting-started.md', lookupMap);

    expect(result).toBeNull();
  });

  test('handles paths that need ./ prefix', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = confluenceLinkToRelativePath('Database Design', 'architecture/overview.md', lookupMap);

    expect(result).toBe('./database.md');
  });
});

describe('extractPageTitleFromLink', () => {
  test('extracts title from ri:page element', () => {
    const html = '<ri:page ri:content-title="Getting Started" />';
    const title = extractPageTitleFromLink(html);

    expect(title).toBe('Getting Started');
  });

  test('extracts title from ac:link element', () => {
    const html = '<ac:link><ri:page ri:content-title="Architecture Overview" /></ac:link>';
    const title = extractPageTitleFromLink(html);

    expect(title).toBe('Architecture Overview');
  });

  test('handles double quotes', () => {
    const html = '<ri:page ri:content-title="Test Page" />';
    const title = extractPageTitleFromLink(html);

    expect(title).toBe('Test Page');
  });

  test('handles single quotes', () => {
    const html = "<ri:page ri:content-title='Test Page' />";
    const title = extractPageTitleFromLink(html);

    expect(title).toBe('Test Page');
  });

  test('returns null if no title found', () => {
    const html = '<ac:link></ac:link>';
    const title = extractPageTitleFromLink(html);

    expect(title).toBeNull();
  });

  test('decodes HTML entities in titles', () => {
    const html = '<ri:page ri:content-title="Page with &amp; ampersand" />';
    const title = extractPageTitleFromLink(html);

    // HTML entities should be decoded
    expect(title).toBe('Page with & ampersand');
  });

  test('decodes angle brackets in titles', () => {
    const html = '<ri:page ri:content-title="Page &lt;with&gt; brackets" />';
    const title = extractPageTitleFromLink(html);

    expect(title).toBe('Page <with> brackets');
  });

  test('decodes quotes in titles', () => {
    const html = '<ri:page ri:content-title="Page with &quot;quotes&quot;" />';
    const title = extractPageTitleFromLink(html);

    expect(title).toBe('Page with "quotes"');
  });
});

describe('relativePathToConfluenceLink', () => {
  let lookupMap: PageLookupMap;

  const pageState = createPageStateCache({
    'page-1': {
      pageId: 'page-1',
      localPath: 'getting-started.md',
      title: 'Getting Started',
    },
    'page-2': {
      pageId: 'page-2',
      localPath: 'architecture/overview.md',
      title: 'Architecture Overview',
    },
    'page-3': {
      pageId: 'page-3',
      localPath: 'architecture/database.md',
      title: 'Database Design',
    },
  });

  test('converts relative path to Confluence link (same directory)', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = relativePathToConfluenceLink('./overview.md', 'architecture/database.md', '/test/space', lookupMap);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Architecture Overview');
    expect(result?.pageId).toBe('page-2');
  });

  test('converts relative path to Confluence link (parent directory)', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = relativePathToConfluenceLink(
      '../getting-started.md',
      'architecture/database.md',
      '/test/space',
      lookupMap,
    );

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Getting Started');
    expect(result?.pageId).toBe('page-1');
  });

  test('converts relative path to Confluence link (child directory)', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = relativePathToConfluenceLink(
      './architecture/overview.md',
      'getting-started.md',
      '/test/space',
      lookupMap,
    );

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Architecture Overview');
    expect(result?.pageId).toBe('page-2');
  });

  test('returns null for non-existent file', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = relativePathToConfluenceLink('./non-existent.md', 'getting-started.md', '/test/space', lookupMap);

    expect(result).toBeNull();
  });

  test('handles paths without ./ prefix', () => {
    lookupMap = buildPageLookupMapFromCache(pageState);
    const result = relativePathToConfluenceLink('database.md', 'architecture/overview.md', '/test/space', lookupMap);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Database Design');
    expect(result?.pageId).toBe('page-3');
  });

  test('handles deeply nested paths', () => {
    const deepPageState = createPageStateCache({
      'page-deep': {
        pageId: 'page-deep',
        localPath: 'a/b/c/d/e/f/g/h/page.md',
        title: 'Deep Page',
      },
    });

    lookupMap = buildPageLookupMapFromCache(deepPageState);
    const result = relativePathToConfluenceLink('./a/b/c/d/e/f/g/h/page.md', 'home.md', '/test/space', lookupMap);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Deep Page');
    expect(result?.pageId).toBe('page-deep');
  });
});

describe('batch config propagation', () => {
  test('in-memory PageStateCache updates allow subsequent link resolution', () => {
    // This test verifies the fix for batch push link resolution
    // When pushing multiple files, the first file's page info should be available
    // for link resolution in subsequent files

    // Start with an empty PageStateCache (simulating start of batch push)
    const pageState: PageStateCache = {
      pages: new Map(),
      pathToPageId: new Map(),
    };

    // At this point, links to page-a.md cannot be resolved
    let lookupMap = buildPageLookupMapFromCache(pageState);
    let result = relativePathToConfluenceLink('./page-a.md', 'page-b.md', '/test/space', lookupMap);
    expect(result).toBeNull();

    // Simulate pushing page-a.md - this updates the in-memory PageStateCache
    const pageAInfo: FullPageInfo = {
      pageId: 'page-a-id',
      localPath: 'page-a.md',
      title: 'Page A',
      version: 1,
    };
    pageState.pages.set('page-a-id', pageAInfo);
    pageState.pathToPageId.set('page-a.md', 'page-a-id');

    // Now rebuild the lookup map with the updated PageStateCache
    // This is what happens during batch push - the updated state is passed to the next file
    lookupMap = buildPageLookupMapFromCache(pageState);

    // Now links to page-a.md CAN be resolved
    result = relativePathToConfluenceLink('./page-a.md', 'page-b.md', '/test/space', lookupMap);
    expect(result).not.toBeNull();
    expect(result?.pageId).toBe('page-a-id');
    expect(result?.title).toBe('Page A');
  });

  test('multiple pages pushed in sequence are all resolvable', () => {
    // Simulates pushing three files where each links to the previous
    const pageState: PageStateCache = {
      pages: new Map(),
      pathToPageId: new Map(),
    };

    // Push page-a.md
    const pageAInfo: FullPageInfo = {
      pageId: 'page-a-id',
      localPath: 'page-a.md',
      title: 'Page A',
      version: 1,
    };
    pageState.pages.set('page-a-id', pageAInfo);
    pageState.pathToPageId.set('page-a.md', 'page-a-id');

    // Push page-b.md (can now link to page-a)
    let lookupMap = buildPageLookupMapFromCache(pageState);
    let result = relativePathToConfluenceLink('./page-a.md', 'page-b.md', '/test/space', lookupMap);
    expect(result?.pageId).toBe('page-a-id');

    const pageBInfo: FullPageInfo = {
      pageId: 'page-b-id',
      localPath: 'page-b.md',
      title: 'Page B',
      version: 1,
    };
    pageState.pages.set('page-b-id', pageBInfo);
    pageState.pathToPageId.set('page-b.md', 'page-b-id');

    // Push page-c.md (can now link to both page-a and page-b)
    lookupMap = buildPageLookupMapFromCache(pageState);

    result = relativePathToConfluenceLink('./page-a.md', 'page-c.md', '/test/space', lookupMap);
    expect(result?.pageId).toBe('page-a-id');

    result = relativePathToConfluenceLink('./page-b.md', 'page-c.md', '/test/space', lookupMap);
    expect(result?.pageId).toBe('page-b-id');
  });
});
