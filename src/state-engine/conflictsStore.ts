import * as vscode from 'vscode';
import {
  CONTORA_CONFLICTS_FILE,
  CONTORA_DATA_DIR,
  CONTORA_STATE_ENGINE_DIR,
} from '../constants';
import {
  emptyConflictsArtifact,
  type ConflictsArtifact,
  type StateConflict,
  CONFLICTS_ARTIFACT_VERSION,
} from './types';

export function conflictsUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(
    folder.uri,
    CONTORA_DATA_DIR,
    CONTORA_STATE_ENGINE_DIR,
    CONTORA_CONFLICTS_FILE,
  );
}

export function parseConflictsArtifact(raw: unknown): ConflictsArtifact | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== CONFLICTS_ARTIFACT_VERSION) {
    return undefined;
  }
  const conflicts: StateConflict[] = [];
  if (Array.isArray(o.conflicts)) {
    for (const item of o.conflicts) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const c = item as Record<string, unknown>;
      if (typeof c.type !== 'string' || typeof c.title !== 'string') {
        continue;
      }
      const sources: StateConflict['sources'] = [];
      if (Array.isArray(c.sources)) {
        for (const s of c.sources) {
          if (s && typeof s === 'object' && typeof (s as { detail?: string }).detail === 'string') {
            const src = (s as { source?: string }).source;
            sources.push({
              source:
                src === 'mcp' || src === 'git' || src === 'events' || src === 'ide' || src === 'state'
                  ? (src as StateConflict['sources'][0]['source'])
                  : 'ide',
              detail: (s as { detail: string }).detail,
            });
          }
        }
      }
      conflicts.push({
        id: typeof c.id === 'string' ? c.id : `conf_${Date.now()}`,
        type: c.type as StateConflict['type'],
        title: c.title,
        sources,
        status: 'UNRESOLVED',
        action: 'Developer review required',
        detectedAt: typeof c.detectedAt === 'number' ? c.detectedAt : Date.now(),
      });
    }
  }
  return {
    version: CONFLICTS_ARTIFACT_VERSION,
    generatedAt: typeof o.generatedAt === 'number' ? o.generatedAt : Date.now(),
    conflicts,
  };
}

export async function readConflictsArtifact(
  folder: vscode.WorkspaceFolder,
): Promise<ConflictsArtifact | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(conflictsUri(folder));
    return parseConflictsArtifact(JSON.parse(Buffer.from(bytes).toString('utf8')));
  } catch {
    return undefined;
  }
}

export async function writeConflictsArtifact(
  folder: vscode.WorkspaceFolder,
  conflicts: readonly StateConflict[],
  now = Date.now(),
): Promise<void> {
  const dirUri = vscode.Uri.joinPath(folder.uri, CONTORA_DATA_DIR, CONTORA_STATE_ENGINE_DIR);
  await vscode.workspace.fs.createDirectory(dirUri);
  const artifact: ConflictsArtifact = {
    version: CONFLICTS_ARTIFACT_VERSION,
    generatedAt: now,
    conflicts: [...conflicts],
  };
  await vscode.workspace.fs.writeFile(
    conflictsUri(folder),
    Buffer.from(JSON.stringify(artifact, null, 2), 'utf8'),
  );
}

export async function deleteConflictsArtifact(folder: vscode.WorkspaceFolder): Promise<void> {
  try {
    await vscode.workspace.fs.delete(conflictsUri(folder), { useTrash: false });
  } catch {
    /* missing OK */
  }
}
