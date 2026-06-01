import * as vscode from 'vscode';
import {
  CONTORA_DATA_DIR,
  CONTORA_INTELLIGENCE_DIR,
  CONTORA_STATE_SUMMARY_FILE,
} from '../constants';
import { STATE_SUMMARY_VERSION, type StateSummary } from './types';

export function stateSummaryUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(
    folder.uri,
    CONTORA_DATA_DIR,
    CONTORA_INTELLIGENCE_DIR,
    CONTORA_STATE_SUMMARY_FILE,
  );
}

export function parseStateSummary(raw: unknown): StateSummary | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== STATE_SUMMARY_VERSION) {
    return undefined;
  }
  return {
    version: STATE_SUMMARY_VERSION,
    generatedAt: typeof o.generatedAt === 'number' ? o.generatedAt : Date.now(),
    project_intent: typeof o.project_intent === 'string' ? o.project_intent : '',
    current_focus: typeof o.current_focus === 'string' ? o.current_focus : '',
    active_domains: Array.isArray(o.active_domains)
      ? o.active_domains.filter((x): x is string => typeof x === 'string')
      : [],
    active_problem_area: typeof o.active_problem_area === 'string' ? o.active_problem_area : '',
    activity_clusters: Array.isArray(o.activity_clusters)
      ? o.activity_clusters
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((c) => ({
            cluster: typeof c.cluster === 'string' ? c.cluster : '',
            files: Array.isArray(c.files) ? c.files.filter((f): f is string => typeof f === 'string') : [],
            weight: typeof c.weight === 'number' ? c.weight : 0,
          }))
          .filter((c) => c.cluster.length > 0)
      : [],
    next_likely_actions: Array.isArray(o.next_likely_actions)
      ? o.next_likely_actions.filter((x): x is string => typeof x === 'string')
      : [],
    confidence: typeof o.confidence === 'number' ? o.confidence : 0,
  };
}

export async function readStateSummary(folder: vscode.WorkspaceFolder): Promise<StateSummary | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(stateSummaryUri(folder));
    return parseStateSummary(JSON.parse(Buffer.from(bytes).toString('utf8')));
  } catch {
    return undefined;
  }
}

export async function writeStateSummary(
  folder: vscode.WorkspaceFolder,
  summary: StateSummary,
): Promise<void> {
  const dirUri = vscode.Uri.joinPath(folder.uri, CONTORA_DATA_DIR, CONTORA_INTELLIGENCE_DIR);
  await vscode.workspace.fs.createDirectory(dirUri);
  const body = JSON.stringify(summary, null, 2);
  await vscode.workspace.fs.writeFile(stateSummaryUri(folder), Buffer.from(body, 'utf8'));
}

export async function deleteStateSummary(folder: vscode.WorkspaceFolder): Promise<void> {
  try {
    await vscode.workspace.fs.delete(stateSummaryUri(folder), { useTrash: false });
  } catch {
    /* missing OK */
  }
}
