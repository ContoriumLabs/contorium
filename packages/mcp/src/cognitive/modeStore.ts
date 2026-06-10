import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  COGNITIVE_MODE_SCHEMA_VERSION,
  type CognitiveModeState,
  type ContoriumMcpMode,
} from './types.js';

const MODE_FILE = 'cognitive.mode.json';

function modePath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora', 'mcp', MODE_FILE);
}

function defaultModeState(): CognitiveModeState {
  return {
    mode: 'A',
    updatedAt: new Date(0).toISOString(),
    source: 'mcp',
    schemaVersion: COGNITIVE_MODE_SCHEMA_VERSION,
  };
}

/** v1 had A=overlay B=core; v2 has A=core B=overlay — invert legacy values. */
export function migrateCognitiveMode(raw: CognitiveModeState): CognitiveModeState {
  if (raw.mode !== 'A' && raw.mode !== 'B') {
    return defaultModeState();
  }
  if (raw.schemaVersion === COGNITIVE_MODE_SCHEMA_VERSION) {
    return raw;
  }
  return {
    mode: raw.mode === 'A' ? 'B' : 'A',
    updatedAt: raw.updatedAt,
    source: raw.source,
    schemaVersion: COGNITIVE_MODE_SCHEMA_VERSION,
  };
}

/** Default A = core runtime. Mode B enables cognitive overlay (includes A). */
export async function readCognitiveMode(workspaceRoot: string): Promise<CognitiveModeState> {
  try {
    const raw = JSON.parse(await fs.readFile(modePath(workspaceRoot), 'utf8')) as CognitiveModeState;
    if (raw.mode === 'A' || raw.mode === 'B') {
      return migrateCognitiveMode(raw);
    }
  } catch {
    /* default */
  }
  return defaultModeState();
}

export function isCognitiveOverlayEnabled(mode: ContoriumMcpMode): boolean {
  return mode === 'B';
}

export async function writeCognitiveMode(
  workspaceRoot: string,
  mode: ContoriumMcpMode,
  source: CognitiveModeState['source'] = 'mcp',
): Promise<CognitiveModeState> {
  const payload: CognitiveModeState = {
    mode,
    updatedAt: new Date().toISOString(),
    source,
    schemaVersion: COGNITIVE_MODE_SCHEMA_VERSION,
  };
  const fp = modePath(workspaceRoot);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}
