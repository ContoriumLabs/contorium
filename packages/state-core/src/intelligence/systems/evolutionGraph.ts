import { evolutionGraphPath } from '../paths.js';
import { readDecisionProvenanceGraph } from '../decisionProvenance.js';
import { readIntentGraphVNext } from '../intentVNext.js';
import type {
  EvolutionGraphArtifact,
  EvolutionGraphChain,
  EvolutionGraphNode,
} from '../types.js';
import { EVOLUTION_GRAPH_SCHEMA } from '../types.js';
import { readProjectEvolutionTimeline } from '../dimensions/projectTimeline.js';
import { readJsonFile, writeJsonFile } from '../dimensions/io.js';

export async function readEvolutionGraph(
  workspaceRoot: string,
): Promise<EvolutionGraphArtifact | null> {
  const raw = await readJsonFile<EvolutionGraphArtifact>(evolutionGraphPath(workspaceRoot));
  if (raw?.schema === EVOLUTION_GRAPH_SCHEMA && Array.isArray(raw.chains)) {
    return raw;
  }
  return null;
}

export function queryEvolutionGraph(
  artifact: EvolutionGraphArtifact,
  topic?: string,
): EvolutionGraphChain[] {
  if (!topic) {
    return [...artifact.chains];
  }
  const needle = topic.toLowerCase();
  return artifact.chains.filter((c) => c.topic.toLowerCase().includes(needle));
}

/**
 * Structured transformation chains (not chronological timeline).
 * Example: Auth V1 → JWT → Multi Tenant → SSO
 */
export async function deriveEvolutionGraph(workspaceRoot: string): Promise<EvolutionGraphArtifact> {
  const [timeline, decisionGraph, intentGraph] = await Promise.all([
    readProjectEvolutionTimeline(workspaceRoot),
    readDecisionProvenanceGraph(workspaceRoot),
    readIntentGraphVNext(workspaceRoot),
  ]);

  const chains: EvolutionGraphChain[] = [];
  const topics = new Map<string, EvolutionGraphNode[]>();

  for (const intent of intentGraph?.nodes ?? []) {
    const key = intent.related_modules[0] ?? intent.intent_id;
    const nodes = topics.get(key) ?? [];
    nodes.push({
      node_id: intent.intent_id,
      label: intent.name,
      stage: 'intent',
      linked_intent: intent.intent_id,
    });
    topics.set(key, nodes);
  }

  for (const decision of decisionGraph?.nodes ?? []) {
    const key = decision.linked_intent || (decision.impact_scope[0] ?? decision.decision_id);
    const nodes = topics.get(key) ?? [];
    nodes.push({
      node_id: decision.decision_id,
      label: decision.selected,
      stage: 'decision',
      linked_intent: decision.linked_intent,
      linked_decision: decision.decision_id,
    });
    topics.set(key, nodes);
  }

  for (const evt of timeline?.events ?? []) {
    if (evt.event_type !== 'decision' && evt.event_type !== 'milestone' && evt.event_type !== 'refactor') {
      continue;
    }
    const key = evt.linked_intent ?? evt.entity_id;
    const nodes = topics.get(key) ?? [];
    nodes.push({
      node_id: evt.event_id,
      label: evt.impact_summary ?? evt.event_type,
      stage: evt.event_type,
      linked_intent: evt.linked_intent,
      linked_decision: evt.linked_decision,
    });
    topics.set(key, nodes);
  }

  for (const [topic, nodes] of topics) {
    if (nodes.length < 2) {
      continue;
    }
    chains.push({
      chain_id: `evo_${topic.replace(/[^\w]+/g, '_')}`,
      topic,
      nodes: nodes.slice(0, 12),
      updated_at: new Date().toISOString(),
    });
  }

  const artifact: EvolutionGraphArtifact = {
    schema: EVOLUTION_GRAPH_SCHEMA,
    updated_at: new Date().toISOString(),
    chains: chains.slice(0, 24),
  };

  await writeJsonFile(evolutionGraphPath(workspaceRoot), artifact);
  return artifact;
}
