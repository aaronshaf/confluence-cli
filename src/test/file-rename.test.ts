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

  test('updates references in other files when renamed with spaceRoot', () => {
    // Create a file that links to another file
    const linkingFile = join(testDir, 'index.md');
    writeFileSync(
      linkingFile,
      `---
title: Index
---

See [Old Guide](./old-guide.md) for details.
`,
    );

    // Create the file that will be renamed
    const filePath = join(testDir, 'old-guide.md');
    const content = `---
title: "New Guide Name"
---

# New Guide Name
`;
    writeFileSync(filePath, content);

    // Rename with spaceRoot to trigger reference updates
    const result = handleFileRename(filePath, 'old-guide.md', 'New Guide Name', content, testDir);

    expect(result.wasRenamed).toBe(true);
    expect(result.finalPath).toBe('new-guide-name.md');

    // Verify the link in the other file was updated
    const linkingContent = readFileSync(linkingFile, 'utf-8');
    expect(linkingContent).toContain('./new-guide-name.md');
    expect(linkingContent).not.toContain('./old-guide.md');
  });

  test('updates references without ./ prefix when renamed with spaceRoot', () => {
    // Create a file that links without ./ prefix
    const linkingFile = join(testDir, 'README.md');
    writeFileSync(
      linkingFile,
      `---
title: README
---

See [Guide](old-guide.md) for details.
`,
    );

    // Create the file that will be renamed
    const filePath = join(testDir, 'old-guide.md');
    const content = `---
title: "New Guide Name"
---

# New Guide Name
`;
    writeFileSync(filePath, content);

    // Rename with spaceRoot to trigger reference updates
    const result = handleFileRename(filePath, 'old-guide.md', 'New Guide Name', content, testDir);

    expect(result.wasRenamed).toBe(true);

    // Verify the link was updated (preserving no-prefix style)
    const linkingContent = readFileSync(linkingFile, 'utf-8');
    expect(linkingContent).toContain('new-guide-name.md');
    expect(linkingContent).not.toContain('old-guide.md');
  });

  test('updates references in subdirectory files when renamed with spaceRoot', () => {
    // Create subdirectory
    const docsDir = join(testDir, 'docs');
    mkdirSync(docsDir);

    // Create a file in subdirectory that links to root file
    const linkingFile = join(docsDir, 'guide.md');
    writeFileSync(
      linkingFile,
      `---
title: Guide
---

See [Overview](../overview.md) for details.
`,
    );

    // Create the file that will be renamed (at root)
    const filePath = join(testDir, 'overview.md');
    const content = `---
title: "Project Overview"
---

# Project Overview
`;
    writeFileSync(filePath, content);

    // Rename with spaceRoot to trigger reference updates
    const result = handleFileRename(filePath, 'overview.md', 'Project Overview', content, testDir);

    expect(result.wasRenamed).toBe(true);
    expect(result.finalPath).toBe('project-overview.md');

    // Verify the relative link in subdirectory file was updated
    const linkingContent = readFileSync(linkingFile, 'utf-8');
    expect(linkingContent).toContain('../project-overview.md');
    expect(linkingContent).not.toContain('../overview.md');
  });

  test('does not update references when no spaceRoot provided', () => {
    // Create a file that links to another file
    const linkingFile = join(testDir, 'index.md');
    writeFileSync(
      linkingFile,
      `---
title: Index
---

See [Old Guide](./old-guide.md) for details.
`,
    );

    // Create the file that will be renamed
    const filePath = join(testDir, 'old-guide.md');
    const content = `---
title: "New Guide Name"
---

# New Guide Name
`;
    writeFileSync(filePath, content);

    // Rename WITHOUT spaceRoot - should not update references
    const result = handleFileRename(filePath, 'old-guide.md', 'New Guide Name', content);

    expect(result.wasRenamed).toBe(true);

    // Verify the link in the other file was NOT updated (no spaceRoot)
    const linkingContent = readFileSync(linkingFile, 'utf-8');
    expect(linkingContent).toContain('./old-guide.md');
    expect(linkingContent).not.toContain('./new-guide-name.md');
  });
});
