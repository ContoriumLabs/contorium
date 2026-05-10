import * as vscode from 'vscode';
import { ProjectState, defaultProjectState } from '../types/state';

const REL_DIR = '.context-recall';
const STATE_FILE = 'state.json';

function statePathForFolder(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(folder.uri, REL_DIR, STATE_FILE);
}

function normalizeMerge(base: ProjectState, patch: Partial<ProjectState>): ProjectState {
  return {
    currentTask: patch.currentTask ?? base.currentTask,
    openFiles: patch.openFiles ?? base.openFiles,
    recentFiles: patch.recentFiles ?? base.recentFiles,
    gitModified: patch.gitModified ?? base.gitModified,
    notes: patch.notes ?? base.notes,
    lastUpdated: Date.now(),
  };
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
    const merged: ProjectState = {
      ...defaultProjectState(),
      currentTask: typeof o.currentTask === 'string' ? o.currentTask : '',
      notes: typeof o.notes === 'string' ? o.notes : '',
      lastUpdated: typeof o.lastUpdated === 'number' ? o.lastUpdated : 0,
      openFiles: Array.isArray(o.openFiles) ? o.openFiles.filter((x): x is string => typeof x === 'string') : [],
      recentFiles: Array.isArray(o.recentFiles) ? o.recentFiles.filter((x): x is string => typeof x === 'string') : [],
      gitModified: Array.isArray(o.gitModified) ? o.gitModified.filter((x): x is string => typeof x === 'string') : [],
    };
    return merged;
  } catch {
    return undefined;
  }
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
    const disk = await readJson(statePathForFolder(folder));
    const state = disk ?? defaultProjectState();
    this.cache.set(k, state);
    return state;
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
    const dir = vscode.Uri.joinPath(folder.uri, REL_DIR);
    const file = statePathForFolder(folder);
    await vscode.workspace.fs.createDirectory(dir);
    const body = JSON.stringify(state, null, 2);
    await vscode.workspace.fs.writeFile(file, Buffer.from(body, 'utf8'));
  }
}
