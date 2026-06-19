import * as fs from 'node:fs';
import * as vscode from 'vscode';
import type {
  ControlCheckResult,
  ControlExecuteResult,
  ControlGovernanceResult,
  ControlIntentResult,
} from '@contora/state-core';

export interface EditorChangeContext {
  diff_text: string;
  lines_added: number;
  lines_removed: number;
}

/** Build a simple line diff between disk and editor buffer for change-aware review. */
export function buildEditorChangeContext(editor: vscode.TextEditor): EditorChangeContext | undefined {
  const doc = editor.document;
  if (!doc.isDirty) {
    return undefined;
  }
  let diskText: string;
  try {
    diskText = fs.readFileSync(doc.uri.fsPath, 'utf8');
  } catch {
    return undefined;
  }
  const current = doc.getText();
  if (diskText === current) {
    return undefined;
  }

  const oldLines = diskText.split('\n');
  const newLines = current.split('\n');
  const diffLines: string[] = [];
  let added = 0;
  let removed = 0;
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      continue;
    }
    if (o !== undefined) {
      diffLines.push(`-${o}`);
      removed++;
    }
    if (n !== undefined) {
      diffLines.push(`+${n}`);
      added++;
    }
  }
  if (diffLines.length === 0) {
    return undefined;
  }
  return {
    diff_text: diffLines.slice(0, 400).join('\n'),
    lines_added: added,
    lines_removed: removed,
  };
}

async function loadControl(workspaceRoot: string) {
  const core = await import('@contora/state-core');
  return core.createControlSurface(workspaceRoot, 'ide');
}

export async function ideControlGovernance(
  folder: vscode.WorkspaceFolder,
): Promise<ControlGovernanceResult> {
  const control = await loadControl(folder.uri.fsPath);
  return control.getGovernance();
}

export async function ideControlCheckActiveFile(
  folder: vscode.WorkspaceFolder,
  editor: vscode.TextEditor | undefined,
  changeCtx?: EditorChangeContext,
  opts?: { strict?: boolean },
): Promise<ControlCheckResult | ControlExecuteResult> {
  const control = await loadControl(folder.uri.fsPath);
  const doc = editor?.document;
  if (!doc || doc.uri.scheme !== 'file') {
    throw new Error('Open a workspace file to run governance check.');
  }
  const rel = vscode.workspace.asRelativePath(doc.uri, false).replace(/\\/g, '/');
  const snippet = doc.getText().slice(0, 4000);
  const checkInput = {
    type: 'file_write' as const,
    target_path: rel,
    description: `IDE check: ${rel}`,
    code_snippet: snippet,
    diff_text: changeCtx?.diff_text,
    lines_added: changeCtx?.lines_added,
    lines_removed: changeCtx?.lines_removed,
  };
  if (opts?.strict === true) {
    return control.executeAction({
      ...checkInput,
      description: `IDE save/check: ${rel}`,
      strict: true,
      audit: true,
    });
  }
  return control.checkAction(checkInput);
}

export async function ideControlUpdateIntent(
  folder: vscode.WorkspaceFolder,
  userInput: string,
): Promise<ControlIntentResult> {
  const control = await loadControl(folder.uri.fsPath);
  return control.updateIntent(userInput);
}

export async function ideControlEnsureReady(folder: vscode.WorkspaceFolder): Promise<void> {
  const control = await loadControl(folder.uri.fsPath);
  await control.ensureReady();
}
