import { decisionGraphPath } from './paths.js';
import { writeJsonFile, readJsonFile } from '../intelligence/dimensions/io.js';
import type { AdrRecord, DecisionGraphArtifact, DecisionGraphNode } from './types.js';
import { DECISION_GRAPH_SCHEMA } from './types.js';

export function buildDecisionGraphFromAdrs(adrs: AdrRecord[]): DecisionGraphArtifact {
  const nodes: DecisionGraphNode[] = adrs.map((adr) => {
    const edges: string[] = [...adr.related_events];
    if (adr.superseded_by) {
      edges.push(adr.superseded_by);
    }
    for (const other of adrs) {
      if (other.id !== adr.id && other.superseded_by === adr.id) {
        edges.push(other.id);
      }
    }
    return {
      id: adr.id,
      title: adr.title,
      status: adr.status,
      reason: adr.reason,
      edges: [...new Set(edges)],
      effective_range: {
        from: adr.date,
        to: adr.status === 'superseded' ? adr.last_verified?.slice(0, 10) : undefined,
      },
    };
  });

  return {
    schema: DECISION_GRAPH_SCHEMA,
    updated_at: new Date().toISOString(),
    nodes,
    projection_of: 'cognitive_events',
    derived_from: adrs.flatMap((a) => a.related_events).slice(0, 64),
  };
}

export async function persistDecisionGraph(
  workspaceRoot: string,
  adrs: AdrRecord[],
): Promise<DecisionGraphArtifact> {
  const graph = buildDecisionGraphFromAdrs(adrs);
  await writeJsonFile(decisionGraphPath(workspaceRoot), graph);
  return graph;
}

export async function readDecisionGraph(
  workspaceRoot: string,
): Promise<DecisionGraphArtifact | null> {
  const raw = await readJsonFile<DecisionGraphArtifact>(decisionGraphPath(workspaceRoot));
  if (raw?.schema === DECISION_GRAPH_SCHEMA && Array.isArray(raw.nodes)) {
    return raw;
  }
  return null;
}
