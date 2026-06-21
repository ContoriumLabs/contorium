import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { GovernanceReviewArtifact } from '../governance/governanceReview.js';
import type { GovernanceDecisionAction } from '../governance/governanceArtifacts.js';
import { decisionGraphPath, legacyDecisionGraphPath } from './paths.js';
import type { DecisionProvenanceGraph, DecisionProvenanceNode } from './types.js';
import { DECISION_PROVENANCE_SCHEMA } from './types.js';

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function readDecisionProvenanceGraph(
  workspaceRoot: string,
): Promise<DecisionProvenanceGraph | null> {
  let raw = await readJson<DecisionProvenanceGraph>(decisionGraphPath(workspaceRoot));
  if (!raw) {
    raw = await readJson<DecisionProvenanceGraph>(legacyDecisionGraphPath(workspaceRoot));
  }
  if (raw?.schema === DECISION_PROVENANCE_SCHEMA && Array.isArray(raw.nodes)) {
    return raw;
  }
  return null;
}

function reversibilityFromAction(action: GovernanceDecisionAction): DecisionProvenanceNode['reversibility'] {
  if (action === 'block') {
    return 'low';
  }
  if (action === 'warn' || action === 'inject_fix') {
    return 'medium';
  }
  return 'high';
}

export function deriveDecisionProvenanceNode(input: {
  review: GovernanceReviewArtifact;
  action: GovernanceDecisionAction;
  linked_intent?: string;
}): DecisionProvenanceNode {
  const { review, action } = input;
  const chain = review.reason_chain ?? [];
  const ts = review.review_timestamp || new Date(review.generatedAt || Date.now()).toISOString();
  const decisionId = `dec_${review.file.replace(/[^\w]+/g, '_')}_${Date.parse(ts) || Date.now()}`;

  return {
    decision_id: decisionId,
    title: `${review.change_type} · ${review.file}`,
    context: review.recommendation.replace(/_/g, ' '),
    alternatives: chain.length > 1 ? chain.slice(0, -1) : ['no change', 'defer review'],
    selected: review.recommendation,
    reason: chain.join(' → ') || review.impact,
    tradeoffs: [review.impact, review.risk].filter(Boolean),
    impact_scope: [review.file, ...(review.staged_files ?? [])].slice(0, 12),
    linked_intent: input.linked_intent ?? review.file.split('/')[0] ?? 'project',
    reversibility: reversibilityFromAction(action),
    timestamp: ts,
  };
}

/** @deprecated Use deriveDecisionProvenanceNode */
export const buildDecisionProvenanceNode = deriveDecisionProvenanceNode;

export async function appendDecisionProvenanceNode(
  workspaceRoot: string,
  node: DecisionProvenanceNode,
): Promise<DecisionProvenanceGraph> {
  const existing = (await readDecisionProvenanceGraph(workspaceRoot)) ?? {
    schema: DECISION_PROVENANCE_SCHEMA,
    updated_at: new Date().toISOString(),
    nodes: [],
    edges: [],
  };

  const nodes = [...existing.nodes.filter((n) => n.decision_id !== node.decision_id), node].slice(-64);
  const edges = [...existing.edges];
  if (nodes.length > 1) {
    const prev = nodes[nodes.length - 2]!;
    edges.push({ from: prev.decision_id, to: node.decision_id, relation: 'evolved_from' });
  }

  const graph: DecisionProvenanceGraph = {
    schema: DECISION_PROVENANCE_SCHEMA,
    updated_at: new Date().toISOString(),
    nodes,
    edges: edges.slice(-128),
  };

  await writeJson(decisionGraphPath(workspaceRoot), graph);
  await writeJson(legacyDecisionGraphPath(workspaceRoot), graph).catch(() => undefined);
  const { appendDecisionLogEntry } = await import('./systems/decisionLog.js');
  await appendDecisionLogEntry(workspaceRoot, node).catch(() => undefined);
  return graph;
}
