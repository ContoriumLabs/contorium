/** v0.7 Intent Graph Layer — graph schema (`.contora/intent-graph/graph.json`). */

export type IntentGraphStatus = 'ACTIVE' | 'WEAKENING' | 'PARTIAL' | 'STALE' | 'ARCHIVED';

export type IntentEdgeType = 'AFFECTS' | 'DERIVED_FROM' | 'CONFLICTS_WITH' | 'RELATED_TO';

export interface IntentNode {
  id: string;
  text: string;
  status: IntentGraphStatus;
  confidence: number;
  relatedFiles: string[];
  lastUpdated: number;
  learnedAt: number;
}

export interface IntentEdge {
  from: string;
  to: string;
  type: IntentEdgeType;
}

export interface IntentGraph {
  version: 1;
  updatedAt: number;
  nodes: IntentNode[];
  edges: IntentEdge[];
}

export const INTENT_GRAPH_VERSION = 1 as const;

export function emptyIntentGraph(now = Date.now()): IntentGraph {
  return { version: INTENT_GRAPH_VERSION, updatedAt: now, nodes: [], edges: [] };
}

export function fileNodeId(relativePath: string): string {
  return `file:${relativePath.replace(/\\/g, '/').trim()}`;
}

export function isUsableIntentStatus(status: IntentGraphStatus): boolean {
  return status === 'ACTIVE' || status === 'WEAKENING' || status === 'PARTIAL';
}
