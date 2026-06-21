import type * as vscode from 'vscode';
import type { EventStore } from '../core/engine/eventStore';
import type { ProjectState } from '../types/state';
import {
  readConfidenceIndex,
  readDecisionLog,
  readDecisionProvenanceGraph,
  readEvolutionGraph,
  readImpactGraph,
  readIntentGraphVNext,
  readProjectEvolutionTimeline,
  readProjectIntelligenceHealth,
  readProvenanceChain,
} from '@contora/state-core';
import type { SidebarGovernanceStatus } from './sidebarGovernancePanel';
import type { SidebarIntentGraphPanel } from '../cognition/sidebarGraphPanel';
import type { SidebarProjectStatePanel } from '../cognition/sidebarStateBuilderPanel';
import type { SidebarUnderstandingPanel } from '../cognition/sidebarHandoffPanel';

/**
 * Contorium IDE v2.2 — Cognitive Contract aligned projection.
 * North star: AI Project Intelligence Layer (record · structure · project — no agent).
 */
export interface SidebarV22View {
  /** Cognition field — only current_focus is writable in UI; rest derived. */
  cognition: {
    currentFocus: string;
    intent: string;
    state: string;
    understanding: string;
    confidence: string;
  };
  /** Intelligence core — metrics only, no reasoning. */
  intelligence: {
    healthScore: number | null;
    healthCategory: string;
    knowledgeCoverage: number | null;
    confidenceIndex: number | null;
    timelineSummary: string;
    impactRadius: number | null;
    empty: boolean;
  };
  /** Decision intelligence — record-only links, no governance/reasoning UI. */
  decision: {
    decisionSnapshot: string;
    graphSummary: string;
    decisionLinks: string[];
    decisionHistory: string[];
    empty: boolean;
  };
  graph: {
    intentGraph: string;
    structureGraph: string;
    impactOverlay: string;
    evolutionTimeline: string;
    hotspots: string[];
    empty: boolean;
  };
  activity: { lines: string[] };
  structure: {
    stateBuilder: string;
    moduleMap: string[];
    openProblems: string[];
    linkedDecisions: string[];
    nextCognition: string;
    empty: boolean;
  };
  exportLayer: {
    tokenEstimate: number;
    injectPreview: string;
    mcpSnapshotHint: string;
  };
}

const EMPTY_V22: SidebarV22View = {
  cognition: {
    currentFocus: '',
    intent: '—',
    state: '—',
    understanding: '—',
    confidence: '—',
  },
  intelligence: {
    healthScore: null,
    healthCategory: '—',
    knowledgeCoverage: null,
    confidenceIndex: null,
    timelineSummary: '—',
    impactRadius: null,
    empty: true,
  },
  decision: {
    decisionSnapshot: '—',
    graphSummary: '—',
    decisionLinks: [],
    decisionHistory: [],
    empty: true,
  },
  graph: {
    intentGraph: '—',
    structureGraph: '—',
    impactOverlay: '—',
    evolutionTimeline: '—',
    hotspots: [],
    empty: true,
  },
  activity: { lines: [] },
  structure: {
    stateBuilder: '—',
    moduleMap: [],
    openProblems: [],
    linkedDecisions: [],
    nextCognition: '—',
    empty: true,
  },
  exportLayer: {
    tokenEstimate: 0,
    injectPreview: 'Cognitive Snapshot · ~300–800 tokens',
    mcpSnapshotHint: 'MCP: transfer_context · transfer_intelligence · transfer_handoff',
  },
};

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) {
    return '—';
  }
  return `${Math.round(n * 100)}%`;
}

function rawActivityLines(events: EventStore | undefined, limit = 8): string[] {
  const all = events?.getAll() ?? [];
  return all
    .slice(-limit)
    .reverse()
    .map((e) => {
      const file =
        'file' in e && typeof e.file === 'string'
          ? e.file.split(/[/\\]/).pop() ?? e.file
          : '';
      return `${e.type}${file ? ` ${file}` : ''}`;
    });
}

export async function buildSidebarV22View(
  folder: vscode.WorkspaceFolder,
  state: ProjectState,
  gov: SidebarGovernanceStatus | Record<string, unknown> | null | undefined,
  understanding: SidebarUnderstandingPanel | null | undefined,
  projectState: SidebarProjectStatePanel | null | undefined,
  intentGraph: SidebarIntentGraphPanel | null | undefined,
  events?: EventStore,
): Promise<SidebarV22View> {
  const root = folder.uri.fsPath;

  const [health, confidence, timeline, impact, provenance, evolution, decisionGraph, intentVNext, decisionLog] =
    await Promise.all([
      readProjectIntelligenceHealth(root),
      readConfidenceIndex(root),
      readProjectEvolutionTimeline(root),
      readImpactGraph(root),
      readProvenanceChain(root),
      readEvolutionGraph(root),
      readDecisionProvenanceGraph(root),
      readIntentGraphVNext(root),
      readDecisionLog(root),
    ]);

  const handoff = understanding?.handoff;
  const kg = understanding?.knowledgeGraph;
  const currentFocus = state.currentTask?.trim() || '';
  const primaryIntent =
    intentVNext?.nodes[0]?.title ??
    intentVNext?.nodes[0]?.name ??
    intentGraph?.projectIntent ??
    '—';

  const observedState =
    handoff?.summary?.slice(0, 120) ||
    (state.openFiles[0] ? `focus: ${state.openFiles[0]}` : state.recentFiles[0] ? `recent: ${state.recentFiles[0]}` : '—');

  const understandingText =
    intentGraph?.problemArea ||
    handoff?.goal ||
    (intentGraph?.domains.length ? intentGraph.domains.slice(0, 3).join(' · ') : '—');

  const latestDecision = decisionGraph?.nodes[decisionGraph.nodes.length - 1];
  const projectConf = confidence?.entities.find((e) => e.entity_id === 'project');
  const latestImpact = impact?.entries[impact.entries.length - 1];
  const radius = latestImpact?.impact_radius ?? latestImpact?.blast_radius ?? null;

  const recentEvents = [...(timeline?.events ?? [])].sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
  const timelineSummary = recentEvents.length
    ? recentEvents.map((e) => `${e.event_type} · ${e.entity_id}`).join(' → ')
    : '—';

  const provEntry = provenance?.entries[0];
  const decisionLinks = provEntry?.chain.length
    ? provEntry.chain.map((l) => `${l.layer} → ${l.entity_id}`).slice(0, 5)
    : latestDecision?.linked_intent
      ? [`intent → ${latestDecision.linked_intent}`]
      : [];

  const decisionHistory = (decisionLog?.entries ?? [])
    .slice(-4)
    .reverse()
    .map((e) => `${e.decision_id}: ${e.selected}`);

  const evoChain = evolution?.chains[0];
  const evolutionTimeline = evoChain
    ? `${evoChain.topic}: ${evoChain.nodes.map((n) => n.label).join(' → ')}`
    : '—';

  const intentSummary =
    intentVNext?.nodes.length ?
      `${intentVNext.nodes.length} intent(s) · ${intentVNext.nodes[0]?.name ?? '—'}`
    : intentGraph?.projectIntent ?? '—';

  const structureSummary = kg?.intentTrees.length
    ? `${kg.intentTrees.length} intent tree(s)`
    : understanding?.graph.nodes.length
      ? `${understanding.graph.nodes.length} structure node(s)`
      : '—';

  const impactOverlay =
    radius != null ?
      `radius ${radius} · ${latestImpact?.impacted_nodes.length ?? 0} node(s)`
    : '—';

  const nextCognition =
    projectState?.nextActions[0] ??
    handoff?.nextActions[0] ??
    '—';

  const g = gov as SidebarGovernanceStatus | null | undefined;

  return {
    cognition: {
      currentFocus,
      intent: primaryIntent,
      state: observedState,
      understanding: understandingText,
      confidence: pct(projectConf?.confidence_score ?? projectState?.confidence),
    },
    intelligence: {
      healthScore: health?.metrics.health_score ?? null,
      healthCategory: health?.metrics.health_category ?? '—',
      knowledgeCoverage: health?.metrics.knowledge_coverage ?? null,
      confidenceIndex: projectConf?.confidence_score ?? null,
      timelineSummary,
      impactRadius: radius,
      empty: !health?.metrics,
    },
    decision: {
      decisionSnapshot: latestDecision?.selected ?? '—',
      graphSummary: decisionGraph?.nodes.length
        ? `${decisionGraph.nodes.length} recorded decision(s)`
        : '—',
      decisionLinks,
      decisionHistory,
      empty: !decisionGraph?.nodes.length && !decisionLog?.entries.length,
    },
    graph: {
      intentGraph: intentSummary,
      structureGraph: structureSummary,
      impactOverlay,
      evolutionTimeline,
      hotspots: kg?.hotspots?.slice(0, 6).map((h) => h.name) ?? [],
      empty: !intentSummary && !structureSummary,
    },
    activity: { lines: rawActivityLines(events) },
    structure: {
      stateBuilder: projectState?.currentStage ?? projectState?.projectGoal ?? '—',
      moduleMap: projectState?.activeModules ?? understanding?.impact.modules ?? [],
      openProblems: projectState?.openProblems ?? [],
      linkedDecisions: projectState?.recentDecisions ?? [],
      nextCognition,
      empty: projectState?.empty ?? true,
    },
    exportLayer: {
      tokenEstimate: g?.injectionTokenEstimate ?? 0,
      injectPreview: g?.injectPreview?.slice(0, 280) ?? 'Cognitive Snapshot · focus · project · changes · constraints · continuation',
      mcpSnapshotHint: 'MCP: transfer_context · transfer_intelligence · transfer_handoff',
    },
  };
}

export { EMPTY_V22 };
