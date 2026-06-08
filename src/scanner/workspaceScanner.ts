import * as vscode from 'vscode';
import { setGitSubprocessAllowed } from '@contora/state-core';
import { CONTORA_CONFIG_SECTION } from '../constants';
import type { EventStore } from '../core/engine/eventStore';
import { StateManager } from '../state/stateManager';
import { scanGitState, type GitScanResult } from './gitScanner';

function workingSetCap(): number {
  const n = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION).get<number>('workingSetMaxFiles');
  return typeof n === 'number' && n > 0 ? Math.min(200, n) : 40;
}

function asRelativePath(uri: vscode.Uri, folder: vscode.WorkspaceFolder): string | undefined {
  if (uri.scheme !== 'file') {
    return undefined;
  }
  const owner = vscode.workspace.getWorkspaceFolder(uri);
  if (!owner || owner.uri.toString() !== folder.uri.toString()) {
    return undefined;
  }
  const rel = vscode.workspace.asRelativePath(uri, false);
  if (!rel || rel === uri.fsPath) {
    return undefined;
  }
  return rel.replace(/\\/g, '/');
}

function pushFrontUnique(list: string[], item: string, cap: number): string[] {
  const next = [item, ...list.filter((x) => x !== item)];
  return next.slice(0, cap);
}

function collectOpenTabRelativePaths(folder: vscode.WorkspaceFolder): string[] {
  const cap = workingSetCap();
  const out: string[] = [];
  const groups = vscode.window.tabGroups?.all ?? [];
  for (const g of groups) {
    for (const tab of g.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputText) {
        const rel = asRelativePath(input.uri, folder);
        if (rel) {
          out.push(rel);
        }
      } else if (input instanceof vscode.TabInputTextDiff) {
        const rel = asRelativePath(input.modified, folder);
        if (rel) {
          out.push(rel);
        }
      }
    }
  }
  return [...new Set(out)].slice(0, cap);
}

const EDIT_ACTIVITY_DEBOUNCE_MS = 500;

/** Same-path `file_focus` emissions at most once per interval (tab spam / split / Ctrl+Tab). */
const FILE_FOCUS_EMIT_GAP_MS = 5000;
/** Defer first Git/tab scan so extension activate is not blocked on startup. */
const INITIAL_SCAN_DEFER_MS = 2_500;
/** Refresh git.exe only on interval or explicit activity — not every tab/focus persist. */
const GIT_REFRESH_MS = 60_000;

export class WorkspaceScanner {
  private disposables: vscode.Disposable[] = [];
  private gitTimer: ReturnType<typeof setTimeout> | undefined;
  private lastGitSig = '';
  private lastGitRefreshAt = 0;
  /** Last time we appended `file_focus` for a relative path (debounce). */
  private lastFileFocusEmitAt = new Map<string, number>();
  /** Per-path debounce timers for typing → activity stream (sidebar goals order). */
  private editActivityTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly folder: vscode.WorkspaceFolder,
    private readonly state: StateManager,
    private readonly events?: EventStore,
    private readonly onAfterPersist?: () => void,
  ) {}

  flushNow(): Thenable<void> {
    return this.persist(undefined, undefined);
  }

  /** Tab / debounced-edit focus: suppress duplicate `file_focus` for same path within 5s. */
  private emitFileFocusIfAllowed(rel: string): void {
    const now = Date.now();
    const prev = this.lastFileFocusEmitAt.get(rel);
    if (prev !== undefined && now - prev < FILE_FOCUS_EMIT_GAP_MS) {
      return;
    }
    this.lastFileFocusEmitAt.set(rel, now);
    this.events?.add({ type: 'file_focus', file: rel, timestamp: now });
  }

  private cachedGitState(): GitScanResult {
    const cached = this.state.getCached(this.folder);
    return {
      staged: cached?.gitStaged ?? [],
      working: cached?.gitWorking ?? [],
    };
  }

  private async resolveGitState(refresh: boolean): Promise<GitScanResult> {
    const now = Date.now();
    if (!refresh && now - this.lastGitRefreshAt < GIT_REFRESH_MS) {
      return this.cachedGitState();
    }
    if (refresh) {
      setGitSubprocessAllowed(true);
    }
    const gs = await scanGitState(this.folder.uri.fsPath);
    this.lastGitRefreshAt = now;
    return gs;
  }

  private async persist(touchRelative?: string, kind?: 'focus' | 'save'): Promise<void> {
    const folder = this.folder;
    const cap = workingSetCap();
    const openFiles = collectOpenTabRelativePaths(folder);
    let recent = this.state.getCached(folder)?.recentFiles ?? [];
    if (touchRelative) {
      recent = pushFrontUnique(recent, touchRelative, cap);
    }

    if (touchRelative && kind === 'focus') {
      this.emitFileFocusIfAllowed(touchRelative);
    }
    if (touchRelative && kind === 'save') {
      this.events?.add({ type: 'file_save', file: touchRelative, timestamp: Date.now() });
    }

    const gs = await this.resolveGitState(kind === 'save');
    const sig = JSON.stringify(gs);
    if (sig !== this.lastGitSig) {
      this.lastGitSig = sig;
      this.events?.add({
        type: 'git_change',
        modified: gs.working,
        staged: gs.staged,
        timestamp: Date.now(),
      });
    }

    await this.state.update(folder, {
      openFiles,
      recentFiles: recent,
      gitStaged: gs.staged,
      gitWorking: gs.working,
    });
    this.onAfterPersist?.();
  }

  start(options?: { deferInitialScan?: boolean }): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((ed) => {
        if (!ed?.document) {
          return;
        }
        const rel = asRelativePath(ed.document.uri, this.folder);
        if (!rel) {
          return;
        }
        void this.persist(rel, 'focus');
      }),
    );

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length === 0) {
          return;
        }
        const ed = vscode.window.activeTextEditor;
        if (!ed || e.document !== ed.document) {
          return;
        }
        const rel = asRelativePath(e.document.uri, this.folder);
        if (!rel) {
          return;
        }
        const prev = this.editActivityTimers.get(rel);
        if (prev !== undefined) {
          clearTimeout(prev);
        }
        const t = setTimeout(() => {
          this.editActivityTimers.delete(rel);
          this.emitFileFocusIfAllowed(rel);
          this.onAfterPersist?.();
        }, EDIT_ACTIVITY_DEBOUNCE_MS);
        this.editActivityTimers.set(rel, t);
      }),
    );

    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        const rel = asRelativePath(doc.uri, this.folder);
        if (!rel) {
          return;
        }
        const pend = this.editActivityTimers.get(rel);
        if (pend !== undefined) {
          clearTimeout(pend);
          this.editActivityTimers.delete(rel);
        }
        void this.persist(rel, 'save');
      }),
    );

    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(() => {
        void this.persist();
      }),
    );

    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument(() => {
        void this.persist();
      }),
    );

    this.disposables.push(
      vscode.workspace.onDidCreateFiles((e) => {
        const now = Date.now();
        for (const uri of e.files) {
          const rel = asRelativePath(uri, this.folder);
          if (!rel) {
            continue;
          }
          this.events?.add({ type: 'file_create', file: rel, timestamp: now });
        }
        this.onAfterPersist?.();
      }),
    );

    this.disposables.push(
      vscode.workspace.onDidDeleteFiles((e) => {
        const now = Date.now();
        for (const uri of e.files) {
          const rel = asRelativePath(uri, this.folder);
          if (!rel) {
            continue;
          }
          this.events?.add({ type: 'file_delete', file: rel, timestamp: now });
        }
        this.onAfterPersist?.();
      }),
    );

    this.disposables.push(
      vscode.workspace.onDidRenameFiles((e) => {
        const now = Date.now();
        for (const f of e.files) {
          const oldRel = asRelativePath(f.oldUri, this.folder);
          const newRel = asRelativePath(f.newUri, this.folder);
          if (!oldRel || !newRel) {
            continue;
          }
          this.events?.add({ type: 'file_rename', oldFile: oldRel, newFile: newRel, timestamp: now });
        }
        this.onAfterPersist?.();
      }),
    );

    if (options?.deferInitialScan) {
      setTimeout(() => void this.persist(), INITIAL_SCAN_DEFER_MS);
    } else {
      void this.persist();
    }

    this.gitTimer = setInterval(() => {
      void this.persist(undefined, 'save');
    }, GIT_REFRESH_MS);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    for (const t of this.editActivityTimers.values()) {
      clearTimeout(t);
    }
    this.editActivityTimers.clear();
    this.lastFileFocusEmitAt.clear();
    if (this.gitTimer) {
      clearInterval(this.gitTimer);
      this.gitTimer = undefined;
    }
  }
}
