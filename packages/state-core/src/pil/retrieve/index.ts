import { readStateJson } from '../../bootstrap/bootstrapState.js';
import { readWorkspaceStatus } from '../../adapterSync.js';
import { readProjectBuiltState } from '../../state-builder/store.js';
import { readIntentGraphVNext } from '../../intelligence/intentVNext.js';
import { readDecisionProvenanceGraph } from '../../intelligence/decisionProvenance.js';
import { readGovernanceDecision } from '../../governance/governanceArtifacts.js';
import { readDecisionLog } from '../../intelligence/systems/decisionLog.js';
import { readProjectEvolutionTimeline } from '../../intelligence/dimensions/projectTimeline.js';
import { readProjectGraph } from '../../understanding/store.js';
import {
  readConfidenceIndex,
  queryConfidenceIndex,
} from '../../intelligence/dimensions/confidenceIndex.js';
import { readImpactGraph, queryImpactGraph } from '../../intelligence/dimensions/impactGraph.js';
import { readWhyLayer } from '../../intelligence/whyLayer.js';
import {
  readProjectIntelligenceHealth,
  deriveProjectIntelligenceHealth,
} from '../../intelligence/health/projectIntelligenceHealth.js';
import { readEvolutionGraph, queryEvolutionGraph } from '../../intelligence/systems/evolutionGraph.js';
import { readProvenanceChain, queryProvenanceChain } from '../../intelligence/systems/provenanceChain.js';
import { readHandoffArtifact } from '../../understanding/store.js';

/** PIL Retrieve — workspace state bundle. */
export async function retrieveProjectState(workspaceRoot: string) {
  const [state, status, built] = await Promise.all([
    readStateJson(workspaceRoot),
    readWorkspaceStatus(workspaceRoot),
    readProjectBuiltState(workspaceRoot),
  ]);
  return { state, status, built_state: built };
}

export async function retrieveIntentGraph(workspaceRoot: string) {
  return readIntentGraphVNext(workspaceRoot);
}

export async function retrieveDecisionBundle(workspaceRoot: string) {
  const [decision, graph, log] = await Promise.all([
    readGovernanceDecision(workspaceRoot),
    readDecisionProvenanceGraph(workspaceRoot),
    readDecisionLog(workspaceRoot),
  ]);
  return { decision, decision_graph: graph, decision_log: log };
}

export async function retrieveTimeline(workspaceRoot: string) {
  return readProjectEvolutionTimeline(workspaceRoot);
}

export async function retrieveGraph(workspaceRoot: string) {
  return readProjectGraph(workspaceRoot);
}

export async function retrieveConfidence(workspaceRoot: string, entityId?: string) {
  const index = await readConfidenceIndex(workspaceRoot);
  return { index, entities: index ? queryConfidenceIndex(index, entityId) : [] };
}

export async function retrieveImpact(workspaceRoot: string, entityId?: string) {
  const graph = await readImpactGraph(workspaceRoot);
  return { graph, entries: graph ? queryImpactGraph(graph, entityId) : [] };
}

export async function retrieveWhy(workspaceRoot: string) {
  return readWhyLayer(workspaceRoot);
}

export async function retrieveHealth(workspaceRoot: string) {
  let health = await readProjectIntelligenceHealth(workspaceRoot);
  if (!health) {
    health = await deriveProjectIntelligenceHealth(workspaceRoot).catch(() => null);
  }
  return health;
}

export async function retrieveEvolution(workspaceRoot: string, anchor?: string) {
  const graph = await readEvolutionGraph(workspaceRoot);
  return { graph, chains: graph ? queryEvolutionGraph(graph, anchor) : [] };
}

export async function retrieveProvenance(workspaceRoot: string, anchor?: string) {
  const chain = await readProvenanceChain(workspaceRoot);
  return { chain, entries: chain ? queryProvenanceChain(chain, anchor) : [] };
}

export async function retrieveHandoff(workspaceRoot: string) {
  return readHandoffArtifact(workspaceRoot);
}
