import * as vscode from 'vscode';
import { CONTORA_DATA_DIR, CONTORA_LEGACY_DATA_DIR } from '../constants';
import { ProjectState, defaultProjectState } from '../types/state';

const STATE_FILE = 'state.json';

function statePath(folder: vscode.WorkspaceFolder, relDir: string): vscode.Uri {
  return vscode.Uri.joinPath(folder.uri, relDir, STATE_FILE);
}

function ideSourceMetadata(base: ProjectState): ProjectState['source'] {
  const mode =
    base.source?.mode === 'scan-driven' || base.source?.mode === 'merged'
      ? 'merged'
      : 'event-driven';
  return {
    mode,
    lastWriter: 'ide',
    lastUpdated: new Date().toISOString(),
  };
}

function normalizeMerge(base: ProjectState, patch: Partial<ProjectState>): ProjectState {
  return {
    sessionId: patch.sessionId ?? base.sessionId,
    currentTask: patch.currentTask ?? base.currentTask,
    openFiles: patch.openFiles ?? base.openFiles,
    recentFiles: patch.recentFiles ?? base.recentFiles,
    gitStaged: patch.gitStaged ?? base.gitStaged,
    gitWorking: patch.gitWorking ?? base.gitWorking,
    notes: patch.notes ?? base.notes,
    lastUpdated: Date.now(),
    source: patch.source ?? ideSourceMetadata(base),
  };
}

function migrateLegacy(o: Record<string, unknown>, merged: ProjectState): ProjectState {
  const legacyModified = o.gitModified;
  if (
    Array.isArray(legacyModified) &&
    legacyModified.every((x): x is string => typeof x === 'string') &&
    merged.gitWorking.length === 0 &&
    merged.gitStaged.length === 0
  ) {
    return {
      ...merged,
      gitWorking: legacyModified.map((p) => p.replace(/\\/g, '/')),
    };
  }
  return merged;
}

async function readJson(uri: vscode.Uri): Promise<ProjectState | undefined> {
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf8');
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }
    const o = parsed as Record<string, unknown>;
    let merged: ProjectState = {
      ...defaultProjectState(),
      sessionId: typeof o.sessionId === 'string' ? o.sessionId : undefined,
      currentTask: typeof o.currentTask === 'string' ? o.currentTask : '',
      notes: typeof o.notes === 'string' ? o.notes : '',
      lastUpdated: typeof o.lastUpdated === 'number' ? o.lastUpdated : 0,
      openFiles: Array.isArray(o.openFiles) ? o.openFiles.filter((x): x is string => typeof x === 'string') : [],
      recentFiles: Array.isArray(o.recentFiles) ? o.recentFiles.filter((x): x is string => typeof x === 'string') : [],
      gitStaged: Array.isArray(o.gitStaged) ? o.gitStaged.filter((x): x is string => typeof x === 'string') : [],
      gitWorking: Array.isArray(o.gitWorking) ? o.gitWorking.filter((x): x is string => typeof x === 'string') : [],
    };
    merged = migrateLegacy(o, merged);
    if (o.source && typeof o.source === 'object') {
      const s = o.source as Record<string, unknown>;
      if (
        (s.mode === 'event-driven' || s.mode === 'scan-driven' || s.mode === 'merged') &&
        (s.lastWriter === 'ide' || s.lastWriter === 'mcp' || s.lastWriter === 'cli') &&
        typeof s.lastUpdated === 'string'
      ) {
        merged.source = {
          mode: s.mode,
          lastWriter: s.lastWriter,
          lastUpdated: s.lastUpdated,
        };
      }
    }
    return merged;
  } catch {
    return undefined;
  }
}

async function loadStateFromDisk(folder: vscode.WorkspaceFolder): Promise<ProjectState | undefined> {
  const primary = await readJson(statePath(folder, CONTORA_DATA_DIR));
  if (primary !== undefined) {
    return primary;
  }
  return readJson(statePath(folder, CONTORA_LEGACY_DATA_DIR));
}

export function newSessionId(): string {
  const rnd =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `sess_${Date.now().toString(36)}_${rnd}`;
}

export class StateManager {
  private cache = new Map<string, ProjectState>();

  getPrimaryFolder(): vscode.WorkspaceFolder | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders?.[0];
  }

  private key(folder: vscode.WorkspaceFolder): string {
    return folder.uri.toString();
  }

  async load(folder: vscode.WorkspaceFolder): Promise<ProjectState> {
    const k = this.key(folder);
    let state = (await loadStateFromDisk(folder)) ?? defaultProjectState();
    if (!state.sessionId) {
      state = { ...state, sessionId: newSessionId() };
      this.cache.set(k, state);
      await this.flush(folder, state);
      return state;
    }
    this.cache.set(k, state);
    return state;
  }

  /** Prefer cache; bounded disk read so sidebar/bootstrap cannot hang on IO locks. */
  async loadResilient(folder: vscode.WorkspaceFolder, timeoutMs = 8_000): Promise<ProjectState> {
    const cached = this.getCached(folder);
    try {
      return await Promise.race([
        this.load(folder),
        new Promise<ProjectState>((_, reject) => {
          setTimeout(() => reject(new Error('state load timeout')), timeoutMs);
        }),
      ]);
    } catch (err) {
      if (cached) {
        console.warn('[Contorium] state load slow/failed — using cache:', err);
        return cached;
      }
      console.warn('[Contorium] state load failed — defaults:', err);
      return defaultProjectState();
    }
  }

  getCached(folder: vscode.WorkspaceFolder): ProjectState | undefined {
    return this.cache.get(this.key(folder));
  }

  async update(folder: vscode.WorkspaceFolder, patch: Partial<ProjectState>): Promise<ProjectState> {
    const prev = this.cache.get(this.key(folder)) ?? (await this.load(folder));
    const next = normalizeMerge(prev, patch);
    this.cache.set(this.key(folder), next);
    await this.flush(folder, next);
    return next;
  }

  async replace(folder: vscode.WorkspaceFolder, full: ProjectState): Promise<void> {
    const next: ProjectState = { ...full, lastUpdated: Date.now() };
    this.cache.set(this.key(folder), next);
    await this.flush(folder, next);
  }

  private async flush(folder: vscode.WorkspaceFolder, state: ProjectState): Promise<void> {
    const dir = vscode.Uri.joinPath(folder.uri, CONTORA_DATA_DIR);
    const file = statePath(folder, CONTORA_DATA_DIR);
    await vscode.workspace.fs.createDirectory(dir);
    const body = JSON.stringify(state, null, 2);
    await vscode.workspace.fs.writeFile(file, Buffer.from(body, 'utf8'));
  }
}
