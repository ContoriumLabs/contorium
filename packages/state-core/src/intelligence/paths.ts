import * as path from 'node:path';

export const IDENTITY_DIR = 'identity';
export const IDENTITY_FILE = 'project_identity.json';
export const INTENT_DIR = 'intent';
export const INTENT_GRAPH_FILE = 'intent_graph.json';
export const INTENT_NODES_FILE = 'intent_nodes.json';
export const WHY_FILE = 'why.json';
export const LEGACY_INTENT_GRAPH = 'intent-graph/graph.json';
export const DECISION_GRAPH_FILE = 'decision_graph.json';
export const TIMELINE_DIR = 'timeline';
export const PROJECT_EVOLUTION_FILE = 'project_timeline.json';
export const GRAPH_DIR = 'graph';
export const IMPACT_GRAPH_FILE = 'impact_graph.json';
export const KNOWLEDGE_GRAPH_FILE = 'knowledge_graph.json';
export const LEGACY_KNOWLEDGE_GRAPH_FILE = 'knowledge.json';
export const CONFIDENCE_DIR = 'confidence';
export const CONFIDENCE_INDEX_FILE = 'confidence_index.json';
/** @deprecated use CONFIDENCE_DIR */
export const STABILITY_DIR = 'confidence';
/** @deprecated use CONFIDENCE_INDEX_FILE */
export const STABILITY_INDEX_FILE = 'confidence_index.json';
export const PROVENANCE_DIR = 'provenance';
export const PROVENANCE_CHAIN_FILE = 'provenance_chain.json';
export const EVOLUTION_DIR = 'evolution';
export const EVOLUTION_GRAPH_FILE = 'evolution_graph.json';
export const INTELLIGENCE_DIR = 'intelligence';
export const INTELLIGENCE_REPOSITORY_STATE_FILE = 'repository_state.json';
export const INTELLIGENCE_SNAPSHOT_FILE = 'snapshot.json';
export const INTELLIGENCE_HEALTH_FILE = 'health.json';
export const INTELLIGENCE_VALIDATION_FILE = 'validation.json';
export const STATE_DIR = 'state';
export const STATE_CANONICAL_FILE = 'state.json';
export const DECISION_DIR = 'decision';
export const DECISION_LOG_FILE = 'decision_log.json';
export const REPOSITORY_RUNTIME_VERSION = '1.1.3';
/** Unified artifact format version — aligned with release */
export const ARTIFACT_SCHEMA_VERSION = REPOSITORY_RUNTIME_VERSION;
/** Public Contorium release version */
export const CONTORIUM_VERSION = REPOSITORY_RUNTIME_VERSION;
/** @deprecated use REPOSITORY_RUNTIME_VERSION */
export const REPOSITORY_SCHEMA_VERSION = REPOSITORY_RUNTIME_VERSION;
/** @deprecated use INTELLIGENCE_DIR */
export const COGNITION_DIR = 'intelligence';
/** @deprecated */
export const COGNITION_ENGINE_STATE_FILE = 'repository_state.json';
/** @deprecated */
export const COGNITION_SNAPSHOT_FILE = 'snapshot.json';

export function contoraRoot(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora');
}

export function identityPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), IDENTITY_DIR, IDENTITY_FILE);
}

export function intentDir(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), INTENT_DIR);
}

export function intentGraphVNextPath(workspaceRoot: string): string {
  return path.join(intentDir(workspaceRoot), INTENT_GRAPH_FILE);
}

export function intentNodesPath(workspaceRoot: string): string {
  return path.join(intentDir(workspaceRoot), INTENT_NODES_FILE);
}

export function whyLayerPath(workspaceRoot: string): string {
  return path.join(intentDir(workspaceRoot), WHY_FILE);
}

export function decisionGraphPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), DECISION_DIR, DECISION_GRAPH_FILE);
}

export function legacyDecisionGraphPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), 'governance', DECISION_GRAPH_FILE);
}

export function decisionLogPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), DECISION_DIR, DECISION_LOG_FILE);
}

export function stateCanonicalPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), STATE_DIR, STATE_CANONICAL_FILE);
}

export function legacyStatePath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), STATE_CANONICAL_FILE);
}

export function intelligenceHealthPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), INTELLIGENCE_DIR, INTELLIGENCE_HEALTH_FILE);
}

export function intelligenceValidationPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), INTELLIGENCE_DIR, INTELLIGENCE_VALIDATION_FILE);
}

export function legacyIntentGraphPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), LEGACY_INTENT_GRAPH);
}

export function projectEvolutionTimelinePath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), TIMELINE_DIR, PROJECT_EVOLUTION_FILE);
}

export function impactGraphPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), GRAPH_DIR, IMPACT_GRAPH_FILE);
}

export function knowledgeGraphCanonicalPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), GRAPH_DIR, KNOWLEDGE_GRAPH_FILE);
}

export function legacyKnowledgeGraphPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), GRAPH_DIR, LEGACY_KNOWLEDGE_GRAPH_FILE);
}

export function confidenceIndexPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), CONFIDENCE_DIR, CONFIDENCE_INDEX_FILE);
}

/** @deprecated use confidenceIndexPath */
export function stabilityIndexPath(workspaceRoot: string): string {
  return confidenceIndexPath(workspaceRoot);
}

export function legacyStabilityIndexPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), 'stability', 'stability_index.json');
}

export function provenanceChainPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), PROVENANCE_DIR, PROVENANCE_CHAIN_FILE);
}

export function evolutionGraphPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), EVOLUTION_DIR, EVOLUTION_GRAPH_FILE);
}

export function intelligenceRepositoryStatePath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), INTELLIGENCE_DIR, INTELLIGENCE_REPOSITORY_STATE_FILE);
}

export function intelligenceSnapshotPath(workspaceRoot: string): string {
  return path.join(contoraRoot(workspaceRoot), INTELLIGENCE_DIR, INTELLIGENCE_SNAPSHOT_FILE);
}

/** @deprecated use intelligenceRepositoryStatePath */
export function cognitionEngineStatePath(workspaceRoot: string): string {
  return intelligenceRepositoryStatePath(workspaceRoot);
}

/** @deprecated use intelligenceSnapshotPath */
export function cognitionSnapshotPath(workspaceRoot: string): string {
  return intelligenceSnapshotPath(workspaceRoot);
}
