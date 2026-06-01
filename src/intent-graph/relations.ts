import type { IntentEdge, IntentEdgeType, IntentNode } from './types';
import { fileNodeId } from './types';

export function upsertAffectsEdge(edges: IntentEdge[], fromId: string, filePath: string): IntentEdge[] {
  const to = fileNodeId(filePath);
  if (edges.some((e) => e.from === fromId && e.to === to && e.type === 'AFFECTS')) {
    return edges;
  }
  return [...edges, { from: fromId, to, type: 'AFFECTS' as IntentEdgeType }];
}

export function relateIntents(edges: IntentEdge[], aId: string, bId: string): IntentEdge[] {
  if (aId === bId) {
    return edges;
  }
  const key = [aId, bId].sort().join('|');
  if (edges.some((e) => e.type === 'RELATED_TO' && [e.from, e.to].sort().join('|') === key)) {
    return edges;
  }
  return [...edges, { from: aId, to: bId, type: 'RELATED_TO' }];
}

export function sharedFileRelation(
  edges: IntentEdge[],
  nodes: readonly IntentNode[],
): IntentEdge[] {
  let next = [...edges];
  const active = nodes.filter((n) => n.status !== 'ARCHIVED' && n.status !== 'STALE');
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      const setB = new Set(b.relatedFiles);
      if (a.relatedFiles.some((f) => setB.has(f))) {
        next = relateIntents(next, a.id, b.id);
      }
    }
  }
  return next;
}

export function tokenizeIntent(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((t) => t.length >= 3),
  );
}

export function intentSimilarity(a: string, b: string): number {
  const ta = tokenizeIntent(a);
  const tb = tokenizeIntent(b);
  if (!ta.size || !tb.size) {
    return 0;
  }
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      inter++;
    }
  }
  return inter / Math.max(ta.size, tb.size);
}
