import type * as vscode from 'vscode';
import { readConflictsArtifact } from '../state-engine';
import type { StateConflict } from '../state-engine/types';

export interface SidebarConflictItem {
  type: string;
  title: string;
  sources: string[];
  status: string;
}

export interface SidebarConflictsPanel {
  count: number;
  items: SidebarConflictItem[];
  updatedAt: number;
  empty: boolean;
}

const EMPTY: SidebarConflictsPanel = {
  count: 0,
  items: [],
  updatedAt: 0,
  empty: true,
};

export async function buildSidebarConflictsPanel(
  folder: vscode.WorkspaceFolder,
): Promise<SidebarConflictsPanel> {
  const artifact = await readConflictsArtifact(folder);
  if (!artifact?.conflicts.length) {
    return { ...EMPTY };
  }
  return {
    count: artifact.conflicts.length,
    items: artifact.conflicts.slice(0, 5).map(mapConflict),
    updatedAt: artifact.generatedAt,
    empty: false,
  };
}

function mapConflict(c: StateConflict): SidebarConflictItem {
  return {
    type: c.type,
    title: c.title,
    sources: c.sources.map((s) => `${s.source.toUpperCase()}: ${s.detail}`),
    status: c.status,
  };
}
