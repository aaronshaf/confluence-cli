# ADR 0011: LLM-Friendly XML Output

## Status

Accepted

## Context

CLI tools are increasingly used with LLMs (piping output to Claude, GPT, etc.). Structured output improves LLM parsing accuracy.

Options:
1. **Human-only output** - Just pretty text
2. **JSON output** - Machine-readable but verbose
3. **XML output** - Structured, LLM-friendly, matches ji pattern

## Decision

Support `--xml` flag for structured XML output on relevant commands.

## Rationale

- **LLM parsing**: XML tags are well-understood by LLMs
- **Structured data**: Clear boundaries between fields
- **ji pattern**: Proven useful in ji project
- **Optional**: Default remains human-friendly

## Implementation

### Global Flag
```
--xml    Output in XML format for LLM consumption
```

### Commands with XML Support
- `cn status` - Space and sync info
- `cn tree` - Page hierarchy
- `cn sync --dry-run` - Pending changes

### Output Examples

#### cn status --xml
```xml
<confluence-status>
  <connection status="connected" url="https://company.atlassian.net"/>
  <space key="ENG" name="Engineering" id="123456"/>
  <sync>
    <last-sync>2024-01-15T10:30:00Z</last-sync>
    <local-pages>42</local-pages>
    <remote-pages>44</remote-pages>
    <pending>
      <added>2</added>
      <modified>1</modified>
      <deleted>0</deleted>
    </pending>
  </sync>
</confluence-status>
```

#### cn tree --xml
```xml
<page-tree space="ENG">
  <page id="1" title="Home" depth="0">
    <page id="2" title="Getting Started" depth="1">
      <page id="3" title="Installation" depth="2"/>
      <page id="4" title="Quick Start" depth="2"/>
    </page>
    <page id="5" title="API Reference" depth="1"/>
  </page>
</page-tree>
```

### Formatter Pattern
```typescript
interface OutputFormatter {
  formatStatus(status: SyncStatus): string;
  formatTree(tree: PageTree): string;
  formatDiff(diff: SyncDiff): string;
}

class HumanFormatter implements OutputFormatter { ... }
class XmlFormatter implements OutputFormatter { ... }

function getFormatter(options: { xml?: boolean }): OutputFormatter {
  return options.xml ? new XmlFormatter() : new HumanFormatter();
}
```

## Consequences

### Positive
- Better LLM integration
- Scriptable output
- Clear data structure
- No breaking change (opt-in)

### Negative
- Two output formats to maintain
- XML is verbose
- Must ensure proper escaping

## XML Escaping
```typescript
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```
