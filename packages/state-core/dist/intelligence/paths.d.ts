export declare const IDENTITY_DIR = "identity";
export declare const IDENTITY_FILE = "project_identity.json";
export declare const INTENT_DIR = "intent";
export declare const INTENT_GRAPH_FILE = "intent_graph.json";
export declare const INTENT_NODES_FILE = "intent_nodes.json";
export declare const WHY_FILE = "why.json";
export declare const LEGACY_INTENT_GRAPH = "intent-graph/graph.json";
export declare const DECISION_GRAPH_FILE = "decision_graph.json";
export declare const TIMELINE_DIR = "timeline";
export declare const PROJECT_EVOLUTION_FILE = "project_timeline.json";
export declare const GRAPH_DIR = "graph";
export declare const IMPACT_GRAPH_FILE = "impact_graph.json";
export declare const KNOWLEDGE_GRAPH_FILE = "knowledge_graph.json";
export declare const LEGACY_KNOWLEDGE_GRAPH_FILE = "knowledge.json";
export declare const CONFIDENCE_DIR = "confidence";
export declare const CONFIDENCE_INDEX_FILE = "confidence_index.json";
/** @deprecated use CONFIDENCE_DIR */
export declare const STABILITY_DIR = "confidence";
/** @deprecated use CONFIDENCE_INDEX_FILE */
export declare const STABILITY_INDEX_FILE = "confidence_index.json";
export declare const PROVENANCE_DIR = "provenance";
export declare const PROVENANCE_CHAIN_FILE = "provenance_chain.json";
export declare const EVOLUTION_DIR = "evolution";
export declare const EVOLUTION_GRAPH_FILE = "evolution_graph.json";
export declare const INTELLIGENCE_DIR = "intelligence";
export declare const INTELLIGENCE_REPOSITORY_STATE_FILE = "repository_state.json";
export declare const INTELLIGENCE_SNAPSHOT_FILE = "snapshot.json";
export declare const INTELLIGENCE_HEALTH_FILE = "health.json";
export declare const INTELLIGENCE_VALIDATION_FILE = "validation.json";
export declare const STATE_DIR = "state";
export declare const STATE_CANONICAL_FILE = "state.json";
export declare const DECISION_DIR = "decision";
export declare const DECISION_LOG_FILE = "decision_log.json";
export declare const REPOSITORY_RUNTIME_VERSION = "1.1.3";
/** Unified artifact format version — aligned with release */
export declare const ARTIFACT_SCHEMA_VERSION = "1.1.3";
/** Public Contorium release version */
export declare const CONTORIUM_VERSION = "1.1.3";
/** @deprecated use REPOSITORY_RUNTIME_VERSION */
export declare const REPOSITORY_SCHEMA_VERSION = "1.1.3";
/** @deprecated use INTELLIGENCE_DIR */
export declare const COGNITION_DIR = "intelligence";
/** @deprecated */
export declare const COGNITION_ENGINE_STATE_FILE = "repository_state.json";
/** @deprecated */
export declare const COGNITION_SNAPSHOT_FILE = "snapshot.json";
export declare function contoraRoot(workspaceRoot: string): string;
export declare function identityPath(workspaceRoot: string): string;
export declare function intentDir(workspaceRoot: string): string;
export declare function intentGraphVNextPath(workspaceRoot: string): string;
export declare function intentNodesPath(workspaceRoot: string): string;
export declare function whyLayerPath(workspaceRoot: string): string;
export declare function decisionGraphPath(workspaceRoot: string): string;
export declare function legacyDecisionGraphPath(workspaceRoot: string): string;
export declare function decisionLogPath(workspaceRoot: string): string;
export declare function stateCanonicalPath(workspaceRoot: string): string;
export declare function legacyStatePath(workspaceRoot: string): string;
export declare function intelligenceHealthPath(workspaceRoot: string): string;
export declare function intelligenceValidationPath(workspaceRoot: string): string;
export declare function legacyIntentGraphPath(workspaceRoot: string): string;
export declare function projectEvolutionTimelinePath(workspaceRoot: string): string;
export declare function impactGraphPath(workspaceRoot: string): string;
export declare function knowledgeGraphCanonicalPath(workspaceRoot: string): string;
export declare function legacyKnowledgeGraphPath(workspaceRoot: string): string;
export declare function confidenceIndexPath(workspaceRoot: string): string;
/** @deprecated use confidenceIndexPath */
export declare function stabilityIndexPath(workspaceRoot: string): string;
export declare function legacyStabilityIndexPath(workspaceRoot: string): string;
export declare function provenanceChainPath(workspaceRoot: string): string;
export declare function evolutionGraphPath(workspaceRoot: string): string;
export declare function intelligenceRepositoryStatePath(workspaceRoot: string): string;
export declare function intelligenceSnapshotPath(workspaceRoot: string): string;
/** @deprecated use intelligenceRepositoryStatePath */
export declare function cognitionEngineStatePath(workspaceRoot: string): string;
/** @deprecated use intelligenceSnapshotPath */
export declare function cognitionSnapshotPath(workspaceRoot: string): string;
//# sourceMappingURL=paths.d.ts.map