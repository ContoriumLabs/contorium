import * as vscode from 'vscode';
import {
  CONTORA_DATA_DIR,
  CONTORA_INTENT_GRAPH_DIR,
  CONTORA_INTENT_GRAPH_FILE,
} from '../constants';
import { INTENT_GRAPH_VERSION, type IntentGraph, type IntentGraphStatus, type IntentEdgeType } from './types';

export function intentGraphUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(
    folder.uri,
    CONTORA_DATA_DIR,
    CONTORA_INTENT_GRAPH_DIR,
    CONTORA_INTENT_GRAPH_FILE,
  );
}

export function parseIntentGraph(raw: unknown): IntentGraph | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== INTENT_GRAPH_VERSION) {
    return undefined;
  }
  const parseStatus = (v: unknown): IntentGraphStatus => {
    if (v === 'ACTIVE' || v === 'WEAKENING' || v === 'PARTIAL' || v === 'STALE' || v === 'ARCHIVED') {
      return v;
    }
    return 'PARTIAL';
  };
  const parseEdgeType = (v: unknown): IntentEdgeType => {
    if (v === 'AFFECTS' || v === 'DERIVED_FROM' || v === 'CONFLICTS_WITH' || v === 'RELATED_TO') {
      return v;
    }
    return 'RELATED_TO';
  };
  return {
    version: INTENT_GRAPH_VERSION,
    updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : Date.now(),
    nodes: Array.isArray(o.nodes)
      ? o.nodes
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((n) => ({
            id: typeof n.id === 'string' ? n.id : '',
            text: typeof n.text === 'string' ? n.text : '',
            status: parseStatus(n.status),
            confidence: typeof n.confidence === 'number' ? n.confidence : 0,
            relatedFiles: Array.isArray(n.relatedFiles)
              ? n.relatedFiles.filter((f): f is string => typeof f === 'string')
              : [],
            lastUpdated: typeof n.lastUpdated === 'number' ? n.lastUpdated : Date.now(),
            learnedAt: typeof n.learnedAt === 'number' ? n.learnedAt : Date.now(),
          }))
          .filter((n) => n.id && n.text)
      : [],
    edges: Array.isArray(o.edges)
      ? o.edges
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((e) => ({
            from: typeof e.from === 'string' ? e.from : '',
            to: typeof e.to === 'string' ? e.to : '',
            type: parseEdgeType(e.type),
          }))
          .filter((e) => e.from && e.to)
      : [],
  };
}

export async function readIntentGraph(folder: vscode.WorkspaceFolder): Promise<IntentGraph | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(intentGraphUri(folder));
    return parseIntentGraph(JSON.parse(Buffer.from(bytes).toString('utf8')));
  } catch {
    return undefined;
  }
}

export async function writeIntentGraph(folder: vscode.WorkspaceFolder, graph: IntentGraph): Promise<void> {
  const dirUri = vscode.Uri.joinPath(folder.uri, CONTORA_DATA_DIR, CONTORA_INTENT_GRAPH_DIR);
  await vscode.workspace.fs.createDirectory(dirUri);
  const body = JSON.stringify(graph, null, 2);
  await vscode.workspace.fs.writeFile(intentGraphUri(folder), Buffer.from(body, 'utf8'));
}

export async function deleteIntentGraph(folder: vscode.WorkspaceFolder): Promise<void> {
  try {
    await vscode.workspace.fs.delete(intentGraphUri(folder), { useTrash: false });
  } catch {
    /* missing OK */
  }
}
