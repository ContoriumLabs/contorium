import * as vscode from 'vscode';
import { StateManager } from '../state/stateManager';
import { scanGitModified } from './gitScanner';

function workingSetCap(): number {
  const n = vscode.workspace.getConfiguration('contextRecall').get<number>('workingSetMaxFiles');
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

export class WorkspaceScanner {
  private disposables: vscode.Disposable[] = [];
  private gitTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly folder: vscode.WorkspaceFolder,
    private readonly state: StateManager,
  ) {}

  /** 立即把当前标签页、Working Set、Git 状态写入磁盘（供命令调用）。 */
  flushNow(): Thenable<void> {
    return this.persist(undefined);
  }

  /**
   * 同步磁盘状态。
   * - `openFiles`：当前所有打开的标签。
   * - `recentFiles`（工作集）：仅在切换活动编辑器或保存时追加，不把「所有已打开标签」一次性合并进来，
   *   避免刚装插件就出现一大串用户并未在本会话操作过的路径。
   */
  private async persist(touchRelative?: string): Promise<void> {
    const folder = this.folder;
    const cap = workingSetCap();
    const openFiles = collectOpenTabRelativePaths(folder);
    let recent = this.state.getCached(folder)?.recentFiles ?? [];
    if (touchRelative) {
      recent = pushFrontUnique(recent, touchRelative, cap);
    }
    const gitModified = await scanGitModified(folder.uri.fsPath);
    await this.state.update(folder, { openFiles, recentFiles: recent, gitModified });
  }

  start(): void {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((ed) => {
        if (!ed?.document) {
          return;
        }
        const rel = asRelativePath(ed.document.uri, this.folder);
        if (!rel) {
          return;
        }
        void this.persist(rel);
      }),
    );

    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        const rel = asRelativePath(doc.uri, this.folder);
        if (!rel) {
          return;
        }
        void this.persist(rel);
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

    void this.persist();

    this.gitTimer = setInterval(() => {
      void this.persist();
    }, 60_000);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    if (this.gitTimer) {
      clearInterval(this.gitTimer);
      this.gitTimer = undefined;
    }
  }
}
