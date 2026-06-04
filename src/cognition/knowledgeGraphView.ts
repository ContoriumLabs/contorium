import type {
  HotspotNode,
  IntentFunctionMapping,
  KnowledgeGraphTreeNode,
  ProjectKnowledgeGraph,
  ReasonTraceItem,
} from '@contora/state-core';

export interface KnowledgeImpactDetail {
  symbol: string;
  affectedIntent?: string;
  affectedFiles: string[];
  affectedFunctions: string[];
  confidence?: number;
}

export interface HotspotSummary {
  name: string;
  kind: 'file' | 'function';
  score: number;
  lifecycle: string;
}

export interface SidebarKnowledgeGraphPanel {
  intentTrees: KnowledgeGraphTreeNode[];
  reasonTraces: ReasonTraceItem[];
  inferenceTraces: ReasonTraceItem[];
  impactDetails: KnowledgeImpactDetail[];
  hotspots: HotspotSummary[];
  avgConfidence: number;
  closureVersion: string;
  schemaVersion: string;
  parserBackend: string;
  empty: boolean;
}

const EMPTY: SidebarKnowledgeGraphPanel = {
  intentTrees: [],
  reasonTraces: [],
  inferenceTraces: [],
  impactDetails: [],
  hotspots: [],
  avgConfidence: 0,
  closureVersion: '—',
  schemaVersion: '—',
  parserBackend: '—',
  empty: true,
};

function buildImpactDetails(kg: ProjectKnowledgeGraph): KnowledgeImpactDetail[] {
  const fnNodes = kg.nodes.filter((n) => n.type === 'function');
  const out: KnowledgeImpactDetail[] = [];

  for (const fn of fnNodes.slice(0, 6)) {
    const mapping = kg.intentMappings
      .filter((m) => m.functionId === fn.id)
      .sort((a, b) => b.confidence - a.confidence)[0];
    const intent = mapping
      ? kg.nodes.find((n) => n.id === mapping.intentId && n.type === 'intent')
      : undefined;
    const callEdges = kg.edges.filter((e) => e.source === fn.id && e.type === 'calls');
    const affectedFunctions = callEdges
      .map((e) => kg.nodes.find((n) => n.id === e.target)?.name)
      .filter((x): x is string => !!x)
      .slice(0, 6);
    const affectedFiles = fn.path ? [fn.path.split('/').pop() ?? fn.path] : [];
    out.push({
      symbol: fn.name + '()',
      affectedIntent: intent?.name,
      affectedFiles,
      affectedFunctions,
      confidence: mapping?.confidence,
    });
  }
  return out;
}

function buildHotspotSummaries(hotspots: HotspotNode[]): HotspotSummary[] {
  return (hotspots ?? []).slice(0, 10).map((h) => ({
    name: h.targetName,
    kind: h.targetKind,
    score: h.score,
    lifecycle: h.lifecycle ?? 'active',
  }));
}

function buildInferenceTraces(
  kg: ProjectKnowledgeGraph,
  inference: IntentFunctionMapping[],
): ReasonTraceItem[] {
  const fnById = new Map(kg.nodes.filter((n) => n.type === 'function').map((n) => [n.id, n]));
  const intentById = new Map(kg.nodes.filter((n) => n.type === 'intent').map((n) => [n.id, n]));
  return inference.slice(0, 6).map((m) => {
    const fn = fnById.get(m.functionId);
    const intent = intentById.get(m.intentId);
    return {
      targetId: m.functionId,
      targetName: fn?.name ?? m.functionId,
      targetType: 'function' as const,
      reasons: [`weak inference (${Math.round(m.confidence * 100)}%)`, ...m.signals.slice(0, 2)],
      editCount: 0,
      dependencyCount: 0,
      linkedIntent: intent?.name,
      confidence: m.confidence,
    };
  });
}

/** Cortex projection only — does not mutate knowledge.json. */
export function buildSidebarKnowledgeGraphPanel(
  kg?: ProjectKnowledgeGraph | null,
  parserBackend = 'regex',
): SidebarKnowledgeGraphPanel {
  if (!kg?.intentTrees?.length && !kg?.reasonTraces?.length && !kg?.hotspots?.length) {
    return { ...EMPTY, parserBackend };
  }
  const inference = kg.inferenceMappings ?? [];
  return {
    intentTrees: kg.intentTrees ?? [],
    reasonTraces: (kg.reasonTraces ?? []).filter((t) => (t.confidence ?? 1) >= 0.7).slice(0, 8),
    inferenceTraces: buildInferenceTraces(kg, inference),
    impactDetails: buildImpactDetails(kg),
    hotspots: buildHotspotSummaries(kg.hotspots ?? []),
    avgConfidence: kg.snapshot?.graphSummary?.avgConfidence ?? 0,
    closureVersion: kg.meta?.closureVersion ?? '—',
    schemaVersion: kg.meta?.schemaVersion ?? '1',
    parserBackend,
    empty: !kg.intentTrees?.length && !kg.hotspots?.length,
  };
}
