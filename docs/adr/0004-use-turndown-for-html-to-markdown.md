# ADR 0004: Use Turndown for HTML to Markdown Conversion

## Status

Accepted

## Context

Confluence stores page content in a proprietary HTML-like "storage format". We need to convert this to Markdown for local files.

Options:
1. **turndown** - Popular, configurable, plugin system
2. **node-html-markdown** - Alternative with good table support
3. **Custom parser** - Full control but high maintenance

## Decision

Use `turndown` library with custom rules for Confluence-specific elements.

## Rationale

- **Proven**: Widely used, well-maintained
- **Configurable**: Rule-based system for custom elements
- **Plugin system**: Can add rules for code blocks, tables, etc.
- **Consistency**: Already used in `ji` project

## Consequences

### Positive
- Reliable HTML to Markdown conversion
- Extensible for Confluence-specific needs
- Active community and maintenance
- Good documentation

### Negative
- Some Confluence macros won't convert cleanly
- May need custom rules for edge cases

## Custom Rules Needed

```typescript
// Code blocks with language
turndownService.addRule('codeBlock', {
  filter: (node) => node.nodeName === 'AC:STRUCTURED-MACRO'
    && node.getAttribute('ac:name') === 'code',
  replacement: (content, node) => {
    const language = node.querySelector('ac:parameter[ac:name="language"]')?.textContent || ''
    const code = node.querySelector('ac:plain-text-body')?.textContent || ''
    return `\n\`\`\`${language}\n${code}\n\`\`\`\n`
  }
})

// Tables
turndownService.use(turndownPluginGfm.tables)
```
