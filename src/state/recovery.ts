import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { ProjectState } from '../types/state';

function maxRestoreEditors(): number {
  const n = vscode.workspace.getConfiguration('contextRecall').get<number>('maxRestoreEditors');
  return typeof n === 'number' && n >= 0 ? Math.min(30, n) : 8;
}

async function tryOpenRelativePath(folder: vscode.WorkspaceFolder, relativePath: string): Promise<boolean> {
  const uri = vscode.Uri.joinPath(folder.uri, relativePath);
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });
    return true;
  } catch {
    try {
      await vscode.commands.executeCommand('vscode.open', uri);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 根据 state 打开最近文件；任务与笔记由侧栏展示，此处只负责编辑器恢复。
 */
export async function restoreEditorsFromState(folder: vscode.WorkspaceFolder, state: ProjectState): Promise<void> {
  const max = maxRestoreEditors();
  if (max === 0) {
    return;
  }
  const ordered: string[] = [];
  for (const p of state.recentFiles) {
    if (!ordered.includes(p)) {
      ordered.push(p);
    }
  }
  for (const p of state.openFiles) {
    if (!ordered.includes(p)) {
      ordered.push(p);
    }
  }
  const slice = ordered.slice(0, max);
  for (const rel of slice) {
    await tryOpenRelativePath(folder, rel);
  }
}

export async function autoRestoreIfEnabled(manager: StateManager, folder: vscode.WorkspaceFolder): Promise<void> {
  const enabled = vscode.workspace.getConfiguration('contextRecall').get<boolean>('autoRestoreOnOpen');
  if (enabled === false) {
    return;
  }
  const state = await manager.load(folder);
  await restoreEditorsFromState(folder, state);
}
