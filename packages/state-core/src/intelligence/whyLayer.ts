import * as fs from 'node:fs/promises';
import { readIdentity } from '../governance/store.js';
import { readHandoffArtifact } from '../understanding/store.js';
import { readDecisionProvenanceGraph } from './decisionProvenance.js';
import { readIntentNodesVNext } from './intentVNext.js';
import { intentDir, whyLayerPath } from './paths.js';
import type { WhyFeatureEntry, WhyLayerArtifact } from './types.js';
import { WHY_LAYER_SCHEMA } from './types.js';

export async function readWhyLayer(workspaceRoot: string): Promise<WhyLayerArtifact | null> {
  try {
    const text = await fs.readFile(whyLayerPath(workspaceRoot), 'utf8');
    const raw = JSON.parse(text) as WhyLayerArtifact;
    if (raw?.schema === WHY_LAYER_SCHEMA && Array.isArray(raw.features)) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

function moduleFromPath(file: string): string {
  const parts = file.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, 2).join('/');
  }
  return parts[0] ?? 'project';
}

export async function syncWhyLayer(workspaceRoot: string): Promise<WhyLayerArtifact> {
  const [identity, handoff, intents, decisions] = await Promise.all([
    readIdentity(workspaceRoot),
    readHandoffArtifact(workspaceRoot),
    readIntentNodesVNext(workspaceRoot),
    readDecisionProvenanceGraph(workspaceRoot),
  ]);

  const features: WhyFeatureEntry[] = [];
  const seen = new Set<string>();

  const push = (entry: WhyFeatureEntry) => {
    const key = entry.feature.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    features.push(entry);
  };

  if (identity?.purpose) {
    push({
      feature: identity.name ?? 'project',
      why: identity.purpose,
      problem: 'Project purpose must persist across AI sessions and tools',
      value: 'Structured inheritance instead of re-explaining architecture',
      origin_decision: decisions?.nodes?.[decisions.nodes.length - 1]?.decision_id ?? '',
      linked_intent: intents[0]?.intent_id ?? 'project',
    });
  }

  for (const intent of intents.slice(0, 24)) {
    push({
      feature: intent.name || intent.intent_id,
      why: intent.why || intent.description,
      problem: 'Intent is lost when switching AI tools or starting new chats',
      value: 'Cross-session project cognition',
      origin_decision: intent.linked_decisions[0] ?? '',
      linked_intent: intent.intent_id,
    });
  }

  if (handoff?.current_focus?.trim()) {
    push({
      feature: moduleFromPath(handoff.current_focus),
      why: handoff.current_focus,
      problem: 'Active work context is invisible to AI without handoff',
      value: 'Continuity for current task and focus',
      origin_decision: decisions?.nodes?.[decisions.nodes.length - 1]?.decision_id ?? '',
      linked_intent: intents.find((i) => i.name.includes(handoff.current_focus))?.intent_id ?? '',
    });
  }

  for (const dec of (decisions?.nodes ?? []).slice(-8)) {
    push({
      feature: dec.title,
      why: dec.reason,
      problem: dec.context,
      value: dec.selected,
      origin_decision: dec.decision_id,
      linked_intent: dec.linked_intent,
    });
  }

  const artifact: WhyLayerArtifact = {
    schema: WHY_LAYER_SCHEMA,
    updated_at: new Date().toISOString(),
    features: features.slice(0, 64),
  };

  await fs.mkdir(intentDir(workspaceRoot), { recursive: true });
  await fs.writeFile(whyLayerPath(workspaceRoot), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return artifact;
}
