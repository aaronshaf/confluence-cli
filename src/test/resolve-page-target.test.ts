import { describe, expect, test } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePageTarget } from '../lib/resolve-page-target.js';

const TMP = '/tmp/cn-test-resolve';

describe('resolvePageTarget', () => {
  test('returns numeric string directly', () => {
    expect(resolvePageTarget('123456')).toBe('123456');
  });

  test('returns large numeric string directly', () => {
    expect(resolvePageTarget('987654321012')).toBe('987654321012');
  });

  test('extracts page_id from .md file frontmatter', () => {
    mkdirSync(TMP, { recursive: true });
    const file = join(TMP, 'page.md');
    writeFileSync(
      file,
      `---\npage_id: "99999"\ntitle: Test\nsynced_at: "2024-01-01T00:00:00Z"\n---\n\nContent here.\n`,
    );
    expect(resolvePageTarget(file)).toBe('99999');
    rmSync(file);
  });

  test('extracts page_id from path containing /', () => {
    mkdirSync(TMP, { recursive: true });
    const file = join(TMP, 'sub.md');
    writeFileSync(file, `---\npage_id: "77777"\ntitle: Sub\nsynced_at: "2024-01-01T00:00:00Z"\n---\n`);
    expect(resolvePageTarget(file)).toBe('77777');
    rmSync(file);
  });

  test('throws when .md file does not exist', () => {
    expect(() => resolvePageTarget('/nonexistent/page.md')).toThrow('File not found');
  });

  test('throws when .md file has no page_id in frontmatter', () => {
    mkdirSync(TMP, { recursive: true });
    const file = join(TMP, 'no-id.md');
    writeFileSync(file, `---\ntitle: No ID\n---\n\nContent.\n`);
    expect(() => resolvePageTarget(file)).toThrow('No page_id found');
    rmSync(file);
  });

  test('throws for non-numeric non-path string', () => {
    expect(() => resolvePageTarget('my-page-slug')).toThrow('Invalid page target');
  });

  test('throws for empty string', () => {
    expect(() => resolvePageTarget('')).toThrow();
  });
});
