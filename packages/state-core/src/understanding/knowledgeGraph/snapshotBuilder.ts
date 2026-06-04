import {
  SNAPSHOT_TOP_FUNCTIONS,
  SNAPSHOT_TOP_HOTSPOTS,
  SNAPSHOT_TOP_INTENTS,
  SNAPSHOT_TOP_NEXT_ACTIONS,
} from './closureConstants.js';
import type {
  HotspotNode,
  IntentFunctionMapping,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeSnapshot,
} from './types.js';

export interface SnapshotBuildInput {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  intentMappings: IntentFunctionMapping[];
  hotspots: HotspotNode[];
  nextActions: string[];
  now: number;
}

/** Derive next actions from intent gaps when L2 next_actions absent (Closure §9.2). */
function deriveSnapshotNextActions(
  nodes: KnowledgeNode[],
  mappings: IntentFunctionMapping[],
  builtNextActions: string[],
): string[] {
  if (builtNextActions.length) {
    return builtNextActions.slice(0, SNAPSHOT_TOP_NEXT_ACTIONS);
  }
  const mappedIntents = new Set(mappings.map((m) => m.intentId));
  const gaps = nodes
    .filter((n) => n.type === 'intent' && !mappedIntents.has(n.id))
    .map((n) => `close intent gap: ${n.name}`);
  return gaps.slice(0, SNAPSHOT_TOP_NEXT_ACTIONS);
}

/**
 * Snapshot Layer — compression projection from canonical graph only (Closure §9).
 * snapshot = compression(graph, weight); never a second truth source.
 */
export function buildKnowledgeSnapshot(input: SnapshotBuildInput): KnowledgeSnapshot {
  const intentScores = new Map<string, number>();
  for (const m of input.intentMappings) {
    const intent = input.nodes.find((n) => n.id === m.intentId && n.type === 'intent');
    if (!intent) {
      continue;
    }
    intentScores.set(intent.name, Math.max(intentScores.get(intent.name) ?? 0, m.confidence));
  }

  const topIntents = [...intentScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SNAPSHOT_TOP_INTENTS)
    .map(([name]) => name);

  const topHotspots = input.hotspots
    .filter((h) => h.lifecycle !== 'stale')
    .slice(0, SNAPSHOT_TOP_HOTSPOTS)
    .map((h) => h.targetName);

  const fnById = new Map(input.nodes.filter((n) => n.type === 'function').map((n) => [n.id, n]));
  const fnScores = new Map<string, number>();
  for (const m of input.intentMappings) {
    const fn = fnById.get(m.functionId);
    if (!fn) {
      continue;
    }
    const hot = input.hotspots.find((h) => h.targetId === fn.id)?.score ?? 0;
    fnScores.set(fn.name, Math.max(fnScores.get(fn.name) ?? 0, m.confidence * Math.max(hot, 0.05)));
  }
  const topFunctions = [...fnScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SNAPSHOT_TOP_FUNCTIONS)
    .map(([name]) => name);

  const confidences = input.intentMappings.map((m) => m.confidence);
  const avgConfidence = confidences.length
    ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
    : 0;

  return {
    generatedAt: input.now,
    topIntents,
    topHotspots,
    topFunctions,
    nextActions: deriveSnapshotNextActions(input.nodes, input.intentMappings, input.nextActions),
    graphSummary: {
      nodeCount: input.nodes.length,
      edgeCount: input.edges.length,
      mappingCount: input.intentMappings.length,
      avgConfidence,
    },
  };
}

/** Filter graph relations by minimum confidence (MCP / export projection). */
export function filterMappingsByConfidence(
  mappings: IntentFunctionMapping[],
  minConfidence: number,
): IntentFunctionMapping[] {
  return mappings.filter((m) => m.confidence >= minConfidence);
}
