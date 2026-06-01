import type { PersistedIntentFile } from '../core/memory/memoryLifecycle';
import type { StateSummary } from '../intelligence/types';
import type { ProjectState } from '../types/state';
import { applyLifecycle } from './lifecycle';
import { intentSimilarity, sharedFileRelation, upsertAffectsEdge } from './relations';
import {
  emptyIntentGraph,
  fileNodeId,
  INTENT_GRAPH_VERSION,
  type IntentGraph,
  type IntentNode,
} from './types';

function newIntentId(): string {
  return `intent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pathTouches(related: readonly string[], changed: string): boolean {
  const c = changed.replace(/\\/g, '/');
  return related.some((r) => {
    const n = r.replace(/\\/g, '/');
    return c === n || c.startsWith(`${n}/`) || n.startsWith(`${c}/`);
  });
}

function taskAligned(task: string, intentText: string): boolean {
  const t = task.trim().toLowerCase();
  const i = intentText.trim().toLowerCase();
  if (t.length < 4 || i.length < 4) {
    return true;
  }
  return t.includes(i.slice(0, Math.min(20, i.length))) || i.includes(t.slice(0, Math.min(20, t.length)));
}

function mergeNodes(primary: IntentNode, secondary: IntentNode, now: number): IntentNode {
  const files = [...new Set([...primary.relatedFiles, ...secondary.relatedFiles])].slice(0, 24);
  return {
    ...primary,
    confidence: Math.max(primary.confidence, secondary.confidence),
    relatedFiles: files,
    lastUpdated: now,
    text: primary.text.length >= secondary.text.length ? primary.text : secondary.text,
  };
}

function upsertIntentNode(
  graph: IntentGraph,
  text: string,
  relatedFiles: string[],
  seedConfidence: number,
  now: number,
): IntentGraph {
  const trimmed = text.trim();
  if (trimmed.length < 4) {
    return graph;
  }
  let nodes = [...graph.nodes];
  let edges = [...graph.edges];
  const existingIdx = nodes.findIndex((n) => intentSimilarity(n.text, trimmed) >= 0.8);
  let nodeId: string;
  if (existingIdx >= 0) {
    const merged = mergeNodes(nodes[existingIdx]!, {
      ...nodes[existingIdx]!,
      text: trimmed,
      relatedFiles,
      confidence: seedConfidence,
      lastUpdated: now,
    }, now);
    nodes[existingIdx] = merged;
    nodeId = merged.id;
  } else {
    nodeId = newIntentId();
    nodes.push({
      id: nodeId,
      text: trimmed,
      status: 'ACTIVE',
      confidence: seedConfidence,
      relatedFiles: relatedFiles.slice(0, 24),
      lastUpdated: now,
      learnedAt: now,
    });
  }
  for (const f of relatedFiles.slice(0, 12)) {
    edges = upsertAffectsEdge(edges, nodeId, f);
  }
  return { ...graph, nodes, edges, updatedAt: now };
}

function refreshNodeLifecycles(
  graph: IntentGraph,
  state: ProjectState,
  changedPaths: string[],
  now: number,
): IntentGraph {
  const task = state.currentTask ?? '';
  const nodes = graph.nodes.map((node) => {
    if (node.status === 'ARCHIVED') {
      return node;
    }
    let relatedHits = 0;
    let driftHits = 0;
    for (const p of changedPaths) {
      if (pathTouches(node.relatedFiles, p)) {
        relatedHits++;
      } else if (node.relatedFiles.length > 0) {
        driftHits++;
      }
    }
    const lastConfirmed = relatedHits > 0 ? now : node.lastUpdated;
    const { confidence, status } = applyLifecycle(node.confidence, {
      learnedAt: node.learnedAt,
      lastUpdated: node.lastUpdated,
      lastConfirmedAt: lastConfirmed,
      relatedFileHits: relatedHits,
      unrelatedDriftHits: driftHits,
      taskAligned: taskAligned(task, node.text),
      now,
    });
    return { ...node, confidence, status, lastUpdated: now };
  });
  let edges = sharedFileRelation(graph.edges, nodes);
  return { ...graph, nodes, edges, updatedAt: now };
}

export interface GraphBuildInput {
  state: ProjectState;
  summary: StateSummary;
  changedPaths: string[];
  persistedIntent?: PersistedIntentFile;
  intentUsable?: boolean;
  existing?: IntentGraph;
  now?: number;
}

/** Incremental graph update — preserves existing nodes, merges similar intents. */
export function buildIntentGraph(input: GraphBuildInput): IntentGraph {
  const now = input.now ?? Date.now();
  let graph = input.existing ?? emptyIntentGraph(now);
  graph = { ...graph, version: INTENT_GRAPH_VERSION };

  const rankedPaths = [
    ...input.summary.activity_clusters.flatMap((c) => c.files),
    ...(input.state.openFiles ?? []),
    ...(input.state.recentFiles ?? []).slice(0, 12),
  ];
  const uniquePaths = [...new Set(rankedPaths.map((p) => p.replace(/\\/g, '/').trim()).filter(Boolean))];

  if (input.summary.project_intent.trim()) {
    graph = upsertIntentNode(
      graph,
      input.summary.project_intent,
      uniquePaths.slice(0, 8),
      Math.max(0.55, input.summary.confidence),
      now,
    );
  }

  for (const action of input.summary.next_likely_actions.slice(0, 3)) {
    graph = upsertIntentNode(graph, action, uniquePaths.slice(0, 6), 0.5, now);
  }

  if (input.persistedIntent && input.intentUsable) {
    const goals = [
      input.persistedIntent.intent.focus,
      ...input.persistedIntent.intent.activeModules,
    ].filter((g) => g.trim().length > 0);
    const lc = input.persistedIntent.lifecycle;
    for (const g of goals.slice(0, 4)) {
      graph = upsertIntentNode(
        graph,
        g,
        lc.relatedFiles.length ? lc.relatedFiles : uniquePaths.slice(0, 6),
        lc.confidence,
        now,
      );
      const node = graph.nodes.find((n) => intentSimilarity(n.text, g) >= 0.8);
      if (node) {
        let edges = graph.edges;
        for (const rf of lc.relatedFiles.slice(0, 8)) {
          edges = upsertAffectsEdge(edges, node.id, rf);
        }
        graph = { ...graph, edges };
      }
    }
  }

  graph = refreshNodeLifecycles(graph, input.state, input.changedPaths, now);

  graph.nodes = graph.nodes
    .filter((n) => n.status !== 'ARCHIVED' || now - n.lastUpdated < 30 * 24 * 60 * 60 * 1000)
    .slice(0, 48);

  return graph;
}

export function activeIntentLines(graph: IntentGraph, max = 5): string[] {
  return graph.nodes
    .filter((n) => n.status === 'ACTIVE' || n.status === 'WEAKENING' || n.status === 'PARTIAL')
    .sort((a, b) => b.confidence - a.confidence || a.text.localeCompare(b.text))
    .slice(0, max)
    .map((n) => `${n.text} (${n.status.toLowerCase()}, ${Math.round(n.confidence * 100)}%)`);
}

export function projectUnderstandingLines(summary: StateSummary): string[] {
  const lines: string[] = [];
  if (summary.project_intent) {
    lines.push(`Project intent: ${summary.project_intent}`);
  }
  if (summary.active_problem_area) {
    lines.push(`Active problem area: ${summary.active_problem_area}`);
  }
  if (summary.active_domains.length) {
    lines.push(`Active domains: ${summary.active_domains.join(', ')}`);
  }
  if (summary.activity_clusters[0]) {
    const c = summary.activity_clusters[0];
    lines.push(`Hotspot: ${c.cluster} (weight ${c.weight})`);
  }
  return lines;
}
