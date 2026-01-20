import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleFileRename } from '../cli/commands/file-rename.js';

describe('handleFileRename', () => {
  const testDir = join(import.meta.dir, '.test-file-rename');

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test('does not rename README.md even with different title', () => {
    const filePath = join(testDir, 'README.md');
    const content = `---
title: "Engineering Wiki"
page_id: page-123
---

# Engineering Wiki

Welcome to the wiki.
`;
    writeFileSync(filePath, content);

    const result = handleFileRename(filePath, 'README.md', 'Engineering Wiki', content);

    expect(result.wasRenamed).toBe(false);
    expect(result.finalPath).toBe('README.md');
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf-8')).toBe(content);
  });

  test('does not rename readme.md (lowercase) even with different title', () => {
    const filePath = join(testDir, 'readme.md');
    const content = `---
title: "My Custom Title"
page_id: page-456
---

# My Custom Title

Content here.
`;
    writeFileSync(filePath, content);

    const result = handleFileRename(filePath, 'readme.md', 'My Custom Title', content);

    expect(result.wasRenamed).toBe(false);
    expect(result.finalPath).toBe('readme.md');
    expect(existsSync(filePath)).toBe(true);
  });

  test('does not rename index.md even with different title', () => {
    const filePath = join(testDir, 'index.md');
    const content = `---
title: "Home Page"
page_id: page-789
---

# Home Page

Welcome.
`;
    writeFileSync(filePath, content);

    const result = handleFileRename(filePath, 'index.md', 'Home Page', content);

    expect(result.wasRenamed).toBe(false);
    expect(result.finalPath).toBe('index.md');
    expect(existsSync(filePath)).toBe(true);
  });

  test('renames regular file when title changes', () => {
    const filePath = join(testDir, 'old-name.md');
    const content = `---
title: "New Name"
page_id: page-101
---

# New Name

Content.
`;
    writeFileSync(filePath, content);

    const result = handleFileRename(filePath, 'old-name.md', 'New Name', content);

    expect(result.wasRenamed).toBe(true);
    expect(result.finalPath).toBe('new-name.md');
    expect(existsSync(join(testDir, 'new-name.md'))).toBe(true);
    expect(existsSync(filePath)).toBe(false);
  });

  test('does not rename if target file already exists', () => {
    const filePath = join(testDir, 'old-name.md');
    const existingPath = join(testDir, 'new-name.md');
    const content = `---
title: "New Name"
---

# New Name
`;
    writeFileSync(filePath, content);
    writeFileSync(existingPath, 'existing content');

    const result = handleFileRename(filePath, 'old-name.md', 'New Name', content);

    expect(result.wasRenamed).toBe(false);
    expect(result.finalPath).toBe('old-name.md');
    expect(existsSync(filePath)).toBe(true);
  });

  test('preserves README.md in subdirectory', () => {
    const subDir = join(testDir, 'docs');
    mkdirSync(subDir);
    const filePath = join(subDir, 'README.md');
    const content = `---
title: "Documentation Overview"
page_id: page-docs
---

# Documentation Overview
`;
    writeFileSync(filePath, content);

    const result = handleFileRename(filePath, 'docs/README.md', 'Documentation Overview', content);

    expect(result.wasRenamed).toBe(false);
    expect(result.finalPath).toBe('docs/README.md');
    expect(existsSync(filePath)).toBe(true);
  });

  test('handles file in subdirectory with rename', () => {
    const subDir = join(testDir, 'guides');
    mkdirSync(subDir);
    const filePath = join(subDir, 'old-guide.md');
    const content = `---
title: "New Guide Name"
---

# New Guide Name
`;
    writeFileSync(filePath, content);

    const result = handleFileRename(filePath, 'guides/old-guide.md', 'New Guide Name', content);

    expect(result.wasRenamed).toBe(true);
    expect(result.finalPath).toBe('guides/new-guide-name.md');
    expect(existsSync(join(subDir, 'new-guide-name.md'))).toBe(true);
  });
});
