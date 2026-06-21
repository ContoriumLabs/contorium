import * as path from 'node:path';
import type { AdapterKind, StateEngineMode } from '../../types.js';
import { readStateJson } from '../../bootstrap/bootstrapState.js';
import { readGovernanceDecision } from '../../governance/governanceArtifacts.js';
import { analyzeImpact } from '../../understanding/impactAnalyzer.js';
import {
  readChangeArtifact,
  readHandoffArtifact,
  readProjectGraph,
  readProjectTimeline,
} from '../../understanding/store.js';
import { readDecisionProvenanceGraph } from '../decisionProvenance.js';
import { readIntentGraphVNext } from '../intentVNext.js';
import { readProjectIdentity } from '../projectIdentity.js';
import { deriveProvenanceChains } from '../systems/provenanceChain.js';
import { deriveEvolutionGraph } from '../systems/evolutionGraph.js';
import {
  contoraRoot,
  decisionGraphPath,
  intentGraphVNextPath,
  identityPath,
} from '../paths.js';
import type {
  ConfidenceIndexEntry,
  DecisionProvenanceGraph,
  IntentGraphVNext,
  ProjectIdentity,
  ProjectEvolutionEvent,
} from '../types.js';
import { deriveImpactPropagation, upsertImpactGraphEntry } from './impactGraph.js';
import {
  appendProjectEvolutionEvents,
  makeEvolutionEvent,
  readProjectEvolutionTimeline,
} from './projectTimeline.js';
import { deriveConfidenceFromSignals, writeConfidenceIndex } from './confidenceIndex.js';
import { writeJsonFile } from './io.js';

function moduleOf(pathLike: string): string {
  return pathLike.replace(/\\/g, '/').split('/')[0] ?? pathLike;
}

async function deriveTimelineEvents(
  workspaceRoot: string,
  writer: AdapterKind,
  prevIdentity: ProjectIdentity | null,
  nextIdentity: ProjectIdentity,
  decisionGraph: Awaited<ReturnType<typeof readDecisionProvenanceGraph>>,
  intentGraph: Awaited<ReturnType<typeof readIntentGraphVNext>>,
): Promise<ProjectEvolutionEvent[]> {
  const events: ProjectEvolutionEvent[] = [];
  const existing = await readProjectEvolutionTimeline(workspaceRoot);
  const knownIds = new Set((existing?.events ?? []).map((e) => e.event_id));

  if (prevIdentity && prevIdentity.current_state_hash !== nextIdentity.current_state_hash) {
    const evt = makeEvolutionEvent({
      event_type: 'state_change',
      entity_id: nextIdentity.project_id,
      before_snapshot: { state_hash: prevIdentity.current_state_hash },
      after_snapshot: { state_hash: nextIdentity.current_state_hash },
      trigger_source: writer,
      impact_summary: 'workspace state hash changed',
    });
    if (!knownIds.has(evt.event_id)) {
      events.push(evt);
    }
  }

  for (const node of decisionGraph?.nodes ?? []) {
    const evt = makeEvolutionEvent({
      event_type: 'decision',
      entity_id: node.decision_id,
      before_snapshot: {},
      after_snapshot: {
        title: node.title,
        selected: node.selected,
        linked_intent: node.linked_intent,
      },
      trigger_source: writer,
      linked_intent: node.linked_intent,
      linked_decision: node.decision_id,
      impact_summary: node.reason.slice(0, 120),
      timestamp: Date.parse(node.timestamp) || Date.now(),
    });
    if (!knownIds.has(evt.event_id)) {
      events.push(evt);
    }
  }

  for (const node of intentGraph?.nodes ?? []) {
    const evt = makeEvolutionEvent({
      event_type: 'intent_change',
      entity_id: node.intent_id,
      before_snapshot: {},
      after_snapshot: { name: node.name, why: node.why },
      trigger_source: writer,
      linked_intent: node.intent_id,
      impact_summary: node.description.slice(0, 120),
      timestamp: Date.parse(node.updated_at) || Date.now(),
    });
    if (!knownIds.has(evt.event_id)) {
      events.push(evt);
    }
  }

  const gitTimeline = await readProjectTimeline(workspaceRoot);
  for (const entry of (gitTimeline?.recent ?? []).slice(0, 8)) {
    const eventType = entry.impact_level === 'high' ? 'milestone' : 'refactor';
    const evt = makeEvolutionEvent({
      event_type: eventType,
      entity_id: entry.file,
      before_snapshot: { commit: entry.commit },
      after_snapshot: { type: entry.type, impact_level: entry.impact_level },
      trigger_source: 'Git',
      impact_summary: `${entry.type} ${entry.file}`,
      timestamp: entry.timestamp * 1000 || Date.now(),
    });
    if (!knownIds.has(evt.event_id)) {
      events.push(evt);
    }
  }

  return events;
}

async function deriveImpactFromChange(workspaceRoot: string): Promise<void> {
  const [change, graph, handoff, decision] = await Promise.all([
    readChangeArtifact(workspaceRoot),
    readProjectGraph(workspaceRoot),
    readHandoffArtifact(workspaceRoot),
    readGovernanceDecision(workspaceRoot),
  ]);

  if (!change && !handoff) {
    return;
  }

  const sourceEntity =
    decision?.decision ??
    change?.key_changes[0]?.symbol ??
    change?.changed_files[0] ??
    handoff?.current_focus ??
    'recent_change';

  let seedModules: string[] = [];
  let relatedModules: string[] = [];
  let riskHint: 'low' | 'medium' | 'high' | 'critical' = 'low';

  if (graph && change) {
    const impact = analyzeImpact(graph, change);
    seedModules = impact.affected_modules.map(moduleOf);
    relatedModules = impact.affected_functions.map(moduleOf);
    riskHint = impact.risk;
  } else if (handoff) {
    seedModules = handoff.impact_summary.affected_modules.map(moduleOf);
    relatedModules = handoff.impact_summary.affected_functions.map(moduleOf);
    riskHint = handoff.impact_summary.risk;
  }

  const entry = deriveImpactPropagation({
    source_entity: String(sourceEntity),
    change_type: change?.key_changes[0]?.change_type ?? 'workspace_update',
    seed_modules: seedModules.length ? seedModules : ['project'],
    related_modules: relatedModules,
    risk_hint: riskHint,
  });

  await upsertImpactGraphEntry(workspaceRoot, entry);
}

async function deriveConfidenceEntities(
  workspaceRoot: string,
  decisionGraph: DecisionProvenanceGraph | null,
  intentGraph: IntentGraphVNext | null,
): Promise<ConfidenceIndexEntry[]> {
  const state = await readStateJson(workspaceRoot);
  const gitTimeline = await readProjectTimeline(workspaceRoot);
  const changeFreq = (gitTimeline?.recent?.length ?? 0) + (state?.gitWorking.length ?? 0) * 0.5;
  const decisionVolatility = decisionGraph?.nodes.length ?? 0;
  const intentChanges = intentGraph?.nodes.length ?? 0;

  const entities: ConfidenceIndexEntry[] = [];
  const now = new Date().toISOString();

  const projectDerived = deriveConfidenceFromSignals({
    change_frequency: changeFreq,
    decision_volatility: decisionVolatility,
    intent_changes: intentChanges,
  });
  entities.push({
    entity_id: 'project',
    ...projectDerived.entry,
    updated_at: now,
  });

  for (const node of intentGraph?.nodes ?? []) {
    const derived = deriveConfidenceFromSignals({
      change_frequency: node.related_modules.length * 0.4,
      decision_volatility: node.linked_decisions.length,
      intent_changes: 1,
    });
    entities.push({
      entity_id: node.intent_id,
      ...derived.entry,
      updated_at: now,
    });
  }

  for (const node of decisionGraph?.nodes ?? []) {
    const derived = deriveConfidenceFromSignals({
      change_frequency: node.impact_scope.length * 0.3,
      decision_volatility: 1,
      intent_changes: 0,
    });
    entities.push({
      entity_id: node.decision_id,
      ...derived.entry,
      updated_at: now,
    });
  }

  return entities;
}

async function embedConfidenceOnArtifacts(
  workspaceRoot: string,
  entities: ConfidenceIndexEntry[],
): Promise<void> {
  const byId = new Map(entities.map((e) => [e.entity_id, e]));

  const intentGraph = await readIntentGraphVNext(workspaceRoot);
  if (intentGraph) {
    const patched: IntentGraphVNext = {
      ...intentGraph,
      nodes: intentGraph.nodes.map((n) => {
        const conf = byId.get(n.intent_id);
        if (!conf) {
          return n;
        }
        return {
          ...n,
          cognition: {
            confidence: conf.confidence_score,
            category: conf.category,
            freshness: conf.freshness,
          },
        };
      }),
    };
    await writeJsonFile(intentGraphVNextPath(workspaceRoot), patched);
  }

  const decisionGraph = await readDecisionProvenanceGraph(workspaceRoot);
  if (decisionGraph) {
    const patched: DecisionProvenanceGraph = {
      ...decisionGraph,
      nodes: decisionGraph.nodes.map((n) => {
        const conf = byId.get(n.decision_id);
        if (!conf) {
          return n;
        }
        return {
          ...n,
          cognition: {
            confidence: conf.confidence_score,
            category: conf.category,
            freshness: conf.freshness,
          },
        };
      }),
    };
    await writeJsonFile(decisionGraphPath(workspaceRoot), patched);
  }

  const projectConf = byId.get('project');
  const identity = await readProjectIdentity(workspaceRoot);
  if (identity && projectConf) {
    const patched: ProjectIdentity = {
      ...identity,
      cognition: {
        confidence: projectConf.confidence_score,
        category: projectConf.category,
        freshness: projectConf.freshness,
      },
    };
    await writeJsonFile(identityPath(workspaceRoot), patched);
  }

  const state = await readStateJson(workspaceRoot);
  if (state && projectConf) {
    const patched = {
      ...state,
      cognition: {
        confidence: projectConf.confidence_score,
        category: projectConf.category,
        freshness: projectConf.freshness,
      },
    };
    const statePath = path.join(contoraRoot(workspaceRoot), 'state.json');
    await writeJsonFile(statePath, patched);
  }
}

/** Capture · Structure · Preserve — descriptive intelligence dimensions only. */
export async function syncProjectIntelligenceDimensions(
  workspaceRoot: string,
  writer: AdapterKind,
  _mode: StateEngineMode = 'merged',
  prevIdentity: ProjectIdentity | null = null,
): Promise<void> {
  const prior = prevIdentity ?? (await readProjectIdentity(workspaceRoot));
  const [decisionGraph, intentGraph] = await Promise.all([
    readDecisionProvenanceGraph(workspaceRoot),
    readIntentGraphVNext(workspaceRoot),
  ]);

  const nextIdentity =
    (await readProjectIdentity(workspaceRoot)) ??
    ({
      project_id: 'project',
      current_state_hash: '',
    } as ProjectIdentity);

  const timelineEvents = await deriveTimelineEvents(
    workspaceRoot,
    writer,
    prior,
    nextIdentity,
    decisionGraph,
    intentGraph,
  );
  if (timelineEvents.length) {
    await appendProjectEvolutionEvents(workspaceRoot, timelineEvents);
  }

  await deriveImpactFromChange(workspaceRoot);

  const confidenceEntities = await deriveConfidenceEntities(workspaceRoot, decisionGraph, intentGraph);
  await writeConfidenceIndex(workspaceRoot, confidenceEntities);
  await embedConfidenceOnArtifacts(workspaceRoot, confidenceEntities);

  await deriveProvenanceChains(workspaceRoot);
  await deriveEvolutionGraph(workspaceRoot);
}

/** @deprecated use syncProjectIntelligenceDimensions */
export const syncCognitiveDimensions = syncProjectIntelligenceDimensions;
