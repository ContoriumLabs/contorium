import type * as vscode from 'vscode';
import {
  formatNextActionPlain,
  readHandoffArtifact,
  readProjectGraph,
  readProjectKnowledgeGraph,
  readProjectTimeline,
  readProjectIntelligenceHealth,
} from '@contora/state-core';
import { buildFunctionGraphView, type FunctionGraphView } from './functionGraphTree';
import { buildSidebarKnowledgeGraphPanel, type SidebarKnowledgeGraphPanel } from './knowledgeGraphView';

export interface SidebarUnderstandingPanel {
  handoff: {
    summary: string;
    goal: string;
    currentFocus: string;
    riskLevel: string;
    changedCount: number;
    impactCount: number;
    nextActions: string[];
    updatedAt: number;
    empty: boolean;
  };
  impact: {
    modules: string[];
    empty: boolean;
  };
  graph: {
    nodes: Array<{ label: string; kind: string }>;
    empty: boolean;
  };
  timeline: {
    entries: Array<{ commit: string; file: string; summary: string; impact: string }>;
    empty: boolean;
  };
  functionGraph: FunctionGraphView;
  knowledgeGraph: SidebarKnowledgeGraphPanel;
  /** PIL v1.1.3 — intelligence health & coverage (.contora/intelligence/health.json) */
  intelligence: {
    healthScore: number | null;
    healthCategory: string;
    knowledgeCoverage: number | null;
    empty: boolean;
  };
}

const EMPTY: SidebarUnderstandingPanel = {
  handoff: {
    summary: '',
    goal: '',
    currentFocus: '',
    riskLevel: '',
    changedCount: 0,
    impactCount: 0,
    nextActions: [],
    updatedAt: 0,
    empty: true,
  },
  impact: { modules: [], empty: true },
  graph: { nodes: [], empty: true },
  timeline: { entries: [], empty: true },
  functionGraph: { trees: [], fileFlows: [], impactLines: [], empty: true },
  knowledgeGraph: { intentTrees: [], reasonTraces: [], inferenceTraces: [], impactDetails: [], hotspots: [], avgConfidence: 0, closureVersion: '—', schemaVersion: '—', parserBackend: '—', empty: true },
  intelligence: { healthScore: null, healthCategory: '—', knowledgeCoverage: null, empty: true },
};

export async function buildSidebarUnderstandingPanel(
  folder: vscode.WorkspaceFolder,
): Promise<SidebarUnderstandingPanel> {
  const root = folder.uri.fsPath;
  const [handoff, graph, timeline, knowledge, pilHealth] = await Promise.all([
    readHandoffArtifact(root),
    readProjectGraph(root),
    readProjectTimeline(root),
    readProjectKnowledgeGraph(root),
    readProjectIntelligenceHealth(root),
  ]);

  if (!handoff && !graph?.nodes?.length) {
    return { ...EMPTY };
  }

  const functionGraph = buildFunctionGraphView(graph, handoff ?? undefined);

  const graphNodes = (graph?.nodes ?? [])
    .filter((n) => n.kind === 'function' || n.kind === 'class')
    .slice(0, 8)
    .map((n) => ({ label: n.name, kind: n.kind }));

  const timelineEntries = (timeline?.recent ?? []).slice(0, 5).map((e) => ({
    commit: e.commit,
    file: e.file.split('/').pop() ?? e.file,
    summary: e.changes.map((c) => c.symbol).slice(0, 3).join(', ') || e.type,
    impact: e.impact_level,
  }));

  const fnChanges = handoff?.key_changes.filter((k) => k.kind === 'function') ?? [];
  const changedCount = fnChanges.length || handoff?.key_changes.length || 0;

  return {
    handoff: {
      summary: handoff?.summary ?? '',
      goal: handoff?.goal ?? '',
      currentFocus: handoff?.current_focus ?? '',
      riskLevel: handoff?.impact_summary.risk ?? '',
      changedCount,
      impactCount: handoff?.impact_summary.affected_functions.length ?? 0,
      nextActions:
        handoff?.next_actions.map((a) => formatNextActionPlain(a)).slice(0, 4) ?? [],
      updatedAt: handoff?.generatedAt ?? 0,
      empty: handoff ? !handoff.summary && !handoff.current_focus : true,
    },
    impact: {
      modules: handoff?.impact_summary.affected_modules.slice(0, 6) ?? [],
      empty: !handoff?.impact_summary.affected_modules.length,
    },
    graph: { nodes: graphNodes, empty: !graphNodes.length },
    timeline: { entries: timelineEntries, empty: !timelineEntries.length },
    functionGraph,
    knowledgeGraph: buildSidebarKnowledgeGraphPanel(knowledge),
    intelligence: {
      healthScore: pilHealth?.metrics.health_score ?? null,
      healthCategory: pilHealth?.metrics.health_category ?? '—',
      knowledgeCoverage: pilHealth?.metrics.knowledge_coverage ?? null,
      empty: !pilHealth?.metrics,
    },
  };
}

/** @deprecated use buildSidebarUnderstandingPanel */
export async function buildSidebarHandoffPanel(folder: vscode.WorkspaceFolder) {
  const p = await buildSidebarUnderstandingPanel(folder);
  return {
    summary: p.handoff.summary,
    intent: p.handoff.currentFocus,
    riskLevel: p.handoff.riskLevel,
    changedCount: p.handoff.changedCount,
    impactCount: p.handoff.impactCount,
    nextActions: p.handoff.nextActions,
    updatedAt: p.handoff.updatedAt,
    empty: p.handoff.empty,
  };
}

export type SidebarHandoffPanel = Awaited<ReturnType<typeof buildSidebarHandoffPanel>>;
