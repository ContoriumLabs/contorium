import type { TaggedEntry } from './types';

const SOURCE_LABEL: Record<TaggedEntry['source'], string> = {
  ide: 'IDE',
  mcp: 'MCP',
  git: 'Git',
  events: 'events',
};

/** Display line with v2 source marker for conflict tracing. */
export function formatTaggedEntry(entry: TaggedEntry): string {
  const label = SOURCE_LABEL[entry.source];
  const text = entry.text.trim();
  if (!text) {
    return '';
  }
  if (/\(from\s+\w+\)$/i.test(text)) {
    return text;
  }
  return `${text} (from ${label})`;
}

export function formatTaggedList(entries: readonly TaggedEntry[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    const line = formatTaggedEntry(e);
    if (!line) {
      continue;
    }
    const k = line.toLowerCase();
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(line);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

/** Parse `(from IDE)` suffix for conflict detector. */
export function parseSourceFromTaggedLine(line: string): TaggedEntry['source'] | undefined {
  const m = line.match(/\(from\s+(IDE|MCP|Git|events)\)\s*$/i);
  if (!m) {
    return undefined;
  }
  const raw = m[1]!.toLowerCase();
  if (raw === 'ide') {
    return 'ide';
  }
  if (raw === 'mcp') {
    return 'mcp';
  }
  if (raw === 'git') {
    return 'git';
  }
  return 'events';
}

export function stripSourceSuffix(line: string): string {
  return line.replace(/\s*\(from\s+(IDE|MCP|Git|events)\)\s*$/i, '').trim();
}
