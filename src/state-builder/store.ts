import * as vscode from 'vscode';
import {
  CONTORA_DATA_DIR,
  CONTORA_PROJECT_SNAPSHOT_FILE,
  CONTORA_PROJECT_STATE_FILE,
  CONTORA_STATE_BUILDER_DIR,
} from '../constants';
import { PROJECT_BUILT_STATE_VERSION, type ProjectBuiltState } from './types';

export function projectStateUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(
    folder.uri,
    CONTORA_DATA_DIR,
    CONTORA_STATE_BUILDER_DIR,
    CONTORA_PROJECT_STATE_FILE,
  );
}

export function projectSnapshotUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(
    folder.uri,
    CONTORA_DATA_DIR,
    CONTORA_STATE_BUILDER_DIR,
    CONTORA_PROJECT_SNAPSHOT_FILE,
  );
}

export function parseProjectBuiltState(raw: unknown): ProjectBuiltState | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== PROJECT_BUILT_STATE_VERSION) {
    return undefined;
  }
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    version: PROJECT_BUILT_STATE_VERSION,
    generatedAt: typeof o.generatedAt === 'number' ? o.generatedAt : Date.now(),
    task_anchor: typeof o.task_anchor === 'string' ? o.task_anchor : undefined,
    engine_version: typeof o.engine_version === 'number' ? o.engine_version : undefined,
    project_goal: typeof o.project_goal === 'string' ? o.project_goal : '',
    current_stage: typeof o.current_stage === 'string' ? o.current_stage : '',
    active_modules: strList(o.active_modules),
    recent_decisions: strList(o.recent_decisions),
    open_problems: strList(o.open_problems),
    completed_milestones: strList(o.completed_milestones),
    next_actions: strList(o.next_actions),
    confidence: typeof o.confidence === 'number' ? o.confidence : 0,
  };
}

export async function readProjectBuiltState(
  folder: vscode.WorkspaceFolder,
): Promise<ProjectBuiltState | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(projectStateUri(folder));
    return parseProjectBuiltState(JSON.parse(Buffer.from(bytes).toString('utf8')));
  } catch {
    return undefined;
  }
}

export async function readProjectSnapshotMarkdown(folder: vscode.WorkspaceFolder): Promise<string | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(projectSnapshotUri(folder));
    const text = Buffer.from(bytes).toString('utf8').trim();
    return text.length ? text : undefined;
  } catch {
    return undefined;
  }
}

export async function writeProjectBuiltState(
  folder: vscode.WorkspaceFolder,
  built: ProjectBuiltState,
  snapshotMarkdown: string,
): Promise<void> {
  const dirUri = vscode.Uri.joinPath(folder.uri, CONTORA_DATA_DIR, CONTORA_STATE_BUILDER_DIR);
  await vscode.workspace.fs.createDirectory(dirUri);
  await vscode.workspace.fs.writeFile(
    projectStateUri(folder),
    Buffer.from(JSON.stringify(built, null, 2), 'utf8'),
  );
  await vscode.workspace.fs.writeFile(projectSnapshotUri(folder), Buffer.from(snapshotMarkdown, 'utf8'));
}

export async function deleteProjectBuiltState(folder: vscode.WorkspaceFolder): Promise<void> {
  for (const uri of [projectStateUri(folder), projectSnapshotUri(folder)]) {
    try {
      await vscode.workspace.fs.delete(uri, { useTrash: false });
    } catch {
      /* missing OK */
    }
  }
}
