import type { AdapterKind, BootstrapStateJson, StateEngineMode, StateSourceMetadata } from './types.js';

export function attachStateSource(
  state: BootstrapStateJson,
  mode: StateEngineMode,
  writer: AdapterKind,
): BootstrapStateJson {
  const source: StateSourceMetadata = {
    mode,
    lastWriter: writer,
    lastUpdated: new Date().toISOString(),
  };
  return { ...state, source };
}

export function parseStateSource(raw: unknown): StateSourceMetadata | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const mode = o.mode;
  const lastWriter = o.lastWriter;
  const lastUpdated = o.lastUpdated;
  if (
    (mode !== 'event-driven' && mode !== 'scan-driven' && mode !== 'merged') ||
    (lastWriter !== 'ide' && lastWriter !== 'mcp' && lastWriter !== 'cli') ||
    typeof lastUpdated !== 'string'
  ) {
    return undefined;
  }
  return { mode, lastWriter, lastUpdated };
}
