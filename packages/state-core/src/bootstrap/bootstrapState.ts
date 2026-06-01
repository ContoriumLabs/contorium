import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { attachStateSource } from '../sourceMetadata.js';
import type { BootstrapStateJson, WriteStateOptions, WorkspaceScanFacts } from '../types.js';

const CONTORA_DIR = '.contora';

function newSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function bootstrapStateFromScan(scan: WorkspaceScanFacts): BootstrapStateJson {
  return {
    sessionId: newSessionId(),
    currentTask: '',
    openFiles: scan.recentFiles.slice(0, 8),
    recentFiles: scan.recentFiles.slice(0, 24),
    gitStaged: scan.gitStaged,
    gitWorking: scan.gitWorking,
    notes: '',
    lastUpdated: scan.scannedAt,
  };
}

export async function readStateJson(workspaceRoot: string): Promise<BootstrapStateJson | null> {
  const fp = path.join(workspaceRoot, CONTORA_DIR, 'state.json');
  try {
    const text = await fs.readFile(fp, 'utf8');
    const o = JSON.parse(text) as Record<string, unknown>;
    const sourceRaw = o.source;
    let source: BootstrapStateJson['source'];
    if (sourceRaw && typeof sourceRaw === 'object') {
      const s = sourceRaw as Record<string, unknown>;
      if (
        (s.mode === 'event-driven' || s.mode === 'scan-driven' || s.mode === 'merged') &&
        (s.lastWriter === 'ide' || s.lastWriter === 'mcp' || s.lastWriter === 'cli') &&
        typeof s.lastUpdated === 'string'
      ) {
        source = {
          mode: s.mode,
          lastWriter: s.lastWriter,
          lastUpdated: s.lastUpdated,
        };
      }
    }
    return {
      sessionId: typeof o.sessionId === 'string' ? o.sessionId : newSessionId(),
      currentTask: typeof o.currentTask === 'string' ? o.currentTask : '',
      openFiles: Array.isArray(o.openFiles)
        ? o.openFiles.filter((x): x is string => typeof x === 'string')
        : [],
      recentFiles: Array.isArray(o.recentFiles)
        ? o.recentFiles.filter((x): x is string => typeof x === 'string')
        : [],
      gitStaged: Array.isArray(o.gitStaged)
        ? o.gitStaged.filter((x): x is string => typeof x === 'string')
        : [],
      gitWorking: Array.isArray(o.gitWorking)
        ? o.gitWorking.filter((x): x is string => typeof x === 'string')
        : [],
      notes: typeof o.notes === 'string' ? o.notes : '',
      lastUpdated: typeof o.lastUpdated === 'number' ? o.lastUpdated : 0,
      source,
    };
  } catch {
    return null;
  }
}

export async function writeStateJson(
  workspaceRoot: string,
  state: BootstrapStateJson,
  meta?: WriteStateOptions,
): Promise<void> {
  const dir = path.join(workspaceRoot, CONTORA_DIR);
  await fs.mkdir(dir, { recursive: true });
  const toWrite = meta ? attachStateSource(state, meta.mode, meta.writer) : state;
  await fs.writeFile(path.join(dir, 'state.json'), JSON.stringify(toWrite, null, 2), 'utf8');
}

export async function stateJsonExists(workspaceRoot: string): Promise<boolean> {
  try {
    await fs.access(path.join(workspaceRoot, CONTORA_DIR, 'state.json'));
    return true;
  } catch {
    return false;
  }
}
