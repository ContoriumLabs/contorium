import { provenanceChainPath } from '../paths.js';
import { readDecisionProvenanceGraph } from '../decisionProvenance.js';
import { readIntentGraphVNext } from '../intentVNext.js';
import { readWhyLayer } from '../whyLayer.js';
import type {
  ProvenanceChainArtifact,
  ProvenanceChainEntry,
  ProvenanceChainLink,
} from '../types.js';
import { PROVENANCE_CHAIN_SCHEMA } from '../types.js';
import { readProjectEvolutionTimeline } from '../dimensions/projectTimeline.js';
import { readJsonFile, writeJsonFile } from '../dimensions/io.js';

export async function readProvenanceChain(
  workspaceRoot: string,
): Promise<ProvenanceChainArtifact | null> {
  const raw = await readJsonFile<ProvenanceChainArtifact>(provenanceChainPath(workspaceRoot));
  if (raw?.schema === PROVENANCE_CHAIN_SCHEMA && Array.isArray(raw.entries)) {
    return raw;
  }
  return null;
}

export function queryProvenanceChain(
  artifact: ProvenanceChainArtifact,
  anchor?: string,
): ProvenanceChainEntry[] {
  if (!anchor) {
    return [...artifact.entries];
  }
  const needle = anchor.toLowerCase();
  return artifact.entries.filter(
    (e) =>
      e.query_anchor.toLowerCase().includes(needle) ||
      e.chain.some(
        (l) =>
          l.entity_id.toLowerCase().includes(needle) ||
          l.label.toLowerCase().includes(needle) ||
          l.layer.toLowerCase().includes(needle),
      ),
  );
}

function buildChainForAnchor(
  anchor: string,
  why?: { feature: string; why: string; origin_decision: string; linked_intent: string },
  decision?: { decision_id: string; title: string; timestamp: string; linked_intent: string },
  intent?: { intent_id: string; name: string; updated_at: string },
  timelineEvent?: { event_id: string; timestamp: number; impact_summary?: string },
): ProvenanceChainEntry {
  const chain: ProvenanceChainLink[] = [];

  if (why) {
    chain.push({
      layer: 'why',
      entity_id: why.feature,
      label: why.why,
    });
  }
  if (decision) {
    chain.push({
      layer: 'decision',
      entity_id: decision.decision_id,
      label: decision.title,
      timestamp: decision.timestamp,
    });
  }
  if (intent) {
    chain.push({
      layer: 'intent',
      entity_id: intent.intent_id,
      label: intent.name,
      timestamp: intent.updated_at,
    });
  }
  if (timelineEvent) {
    chain.push({
      layer: 'timeline',
      entity_id: timelineEvent.event_id,
      label: timelineEvent.impact_summary ?? 'timeline event',
      timestamp: new Date(timelineEvent.timestamp).toISOString(),
    });
  }

  return {
    query_anchor: anchor,
    chain,
    updated_at: new Date().toISOString(),
  };
}

/** Derive trace-back chains: WHY → DECISION → INTENT → TIMELINE (descriptive only). */
export async function deriveProvenanceChains(workspaceRoot: string): Promise<ProvenanceChainArtifact> {
  const [whyLayer, decisionGraph, intentGraph, timeline] = await Promise.all([
    readWhyLayer(workspaceRoot),
    readDecisionProvenanceGraph(workspaceRoot),
    readIntentGraphVNext(workspaceRoot),
    readProjectEvolutionTimeline(workspaceRoot),
  ]);

  const entries: ProvenanceChainEntry[] = [];

  for (const feature of whyLayer?.features ?? []) {
    const decision = decisionGraph?.nodes.find(
      (n: { decision_id: string; linked_intent: string }) =>
        n.decision_id === feature.origin_decision || n.linked_intent === feature.linked_intent,
    );
    const intent = intentGraph?.nodes.find(
      (n: { intent_id: string }) => n.intent_id === feature.linked_intent,
    );
    const evt = timeline?.events.find(
      (e: { linked_intent?: string; linked_decision?: string }) =>
        e.linked_intent === feature.linked_intent || e.linked_decision === feature.origin_decision,
    );
    entries.push(buildChainForAnchor(feature.feature, feature, decision, intent, evt));
  }

  for (const node of decisionGraph?.nodes ?? []) {
    if (entries.some((e) => e.query_anchor === node.title)) {
      continue;
    }
    const intent = intentGraph?.nodes.find(
      (n: { intent_id: string; linked_intent?: string }) => n.intent_id === node.linked_intent,
    );
    const evt = timeline?.events.find(
      (e: { linked_decision?: string }) => e.linked_decision === node.decision_id,
    );
    entries.push(buildChainForAnchor(node.title, undefined, node, intent, evt));
  }

  const artifact: ProvenanceChainArtifact = {
    schema: PROVENANCE_CHAIN_SCHEMA,
    updated_at: new Date().toISOString(),
    entries: entries.slice(0, 48),
  };

  await writeJsonFile(provenanceChainPath(workspaceRoot), artifact);
  return artifact;
}
