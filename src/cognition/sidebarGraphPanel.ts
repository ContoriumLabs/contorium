import type * as vscode from 'vscode';
import { readStateSummary } from '../intelligence';
import { readIntentGraph } from '../intent-graph';
import type { IntentGraphStatus } from '../intent-graph/types';

export interface SidebarIntentGraphItem {
  text: string;
  status: IntentGraphStatus;
  confidence: number;
  relatedFileCount: number;
}

/** Sidebar-facing intent graph summary (v0.7). */
export interface SidebarIntentGraphPanel {
  projectIntent: string;
  problemArea: string;
  domains: string[];
  hotspot: string;
  summaryConfidence: number;
  intents: SidebarIntentGraphItem[];
  updatedAt: number;
  /** True when neither intelligence nor graph artifacts exist yet. */
  empty: boolean;
}

const EMPTY_PANEL: SidebarIntentGraphPanel = {
  projectIntent: '',
  problemArea: '',
  domains: [],
  hotspot: '',
  summaryConfidence: 0,
  intents: [],
  updatedAt: 0,
  empty: true,
};

const USABLE_STATUSES = new Set<IntentGraphStatus>(['ACTIVE', 'WEAKENING', 'PARTIAL']);

export async function buildSidebarGraphPanel(
  folder: vscode.WorkspaceFolder,
): Promise<SidebarIntentGraphPanel> {
  const [summary, graph] = await Promise.all([readStateSummary(folder), readIntentGraph(folder)]);
  if (!summary && !graph) {
    return { ...EMPTY_PANEL };
  }

  const intents: SidebarIntentGraphItem[] = (graph?.nodes ?? [])
    .filter((n) => USABLE_STATUSES.has(n.status))
    .sort((a, b) => b.confidence - a.confidence || a.text.localeCompare(b.text))
    .slice(0, 6)
    .map((n) => ({
      text: n.text,
      status: n.status,
      confidence: n.confidence,
      relatedFileCount: n.relatedFiles.length,
    }));

  const topCluster = summary?.activity_clusters[0];
  return {
    projectIntent: summary?.project_intent ?? '',
    problemArea: summary?.active_problem_area ?? '',
    domains: summary?.active_domains ?? [],
    hotspot: topCluster?.cluster ?? '',
    summaryConfidence: summary?.confidence ?? 0,
    intents,
    updatedAt: graph?.updatedAt ?? summary?.generatedAt ?? 0,
    empty: !summary && (!graph || graph.nodes.length === 0),
  };
}
