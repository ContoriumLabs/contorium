/** Project Intelligence Layer vNext — cognition schemas (not execution). */
export declare const PROJECT_INTELLIGENCE_SCHEMA: "project_intelligence.v1";
export declare const DECISION_PROVENANCE_SCHEMA: "decision_provenance.v1";
export declare const WHY_LAYER_SCHEMA: "why.v1";
export declare const INTENT_VNEXT_SCHEMA: "intent.v1";
export declare const PROJECT_EVOLUTION_SCHEMA: "project_evolution.v1";
export declare const IMPACT_GRAPH_SCHEMA: "impact_graph.v1";
export declare const CONFIDENCE_INDEX_SCHEMA: "confidence_index.v1";
/** @deprecated use CONFIDENCE_INDEX_SCHEMA */
export declare const STABILITY_INDEX_SCHEMA: "confidence_index.v1";
export declare const PROVENANCE_CHAIN_SCHEMA: "provenance_chain.v1";
export declare const EVOLUTION_GRAPH_SCHEMA: "evolution_graph.v1";
export declare const PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA: "project_intelligence_repository.v1";
export declare const PROJECT_INTELLIGENCE_HEALTH_SCHEMA: "project_intelligence_health.v1";
export declare const PROJECT_INTELLIGENCE_VALIDATION_SCHEMA: "project_intelligence_validation.v1";
/** @deprecated use PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA */
export declare const COGNITIVE_ENGINE_SCHEMA: "project_intelligence_repository.v1";
export type ConfidenceCategory = 'stable' | 'evolving' | 'experimental';
/** Descriptive trust metadata — embedded on core intelligence artifacts. */
export interface CognitionConfidenceMeta {
    confidence: number;
    category: ConfidenceCategory;
    freshness: 'recent' | 'historical';
}
/** @deprecated use CognitionConfidenceMeta */
export interface CognitionStabilityMeta {
    confidence: number;
    /** @deprecated use category */
    stability?: ConfidenceCategory;
    category?: ConfidenceCategory;
    freshness: 'recent' | 'historical';
}
export interface ProjectIdentity {
    schema: typeof PROJECT_INTELLIGENCE_SCHEMA;
    project_id: string;
    current_state_hash: string;
    active_intents: string[];
    active_decisions: string[];
    last_tool_source: string;
    runtime_version: string;
    sync_mode: 'strong' | 'merged' | 'scan-driven';
    updated_at: string;
    /** v1.1 — cross-tool identity sync */
    tool_sources?: Array<{
        tool: string;
        last_seen: string;
    }>;
    cognition?: CognitionConfidenceMeta;
}
export interface IntentNodeVNext {
    intent_id: string;
    /** v1.1.3 schema alias — same as name when projected */
    title?: string;
    name: string;
    description: string;
    why: string;
    design_principles: string[];
    constraints: string[];
    related_modules: string[];
    linked_decisions: string[];
    created_at: string;
    updated_at: string;
    cognition?: CognitionConfidenceMeta;
}
export interface IntentGraphVNext {
    schema: typeof INTENT_VNEXT_SCHEMA;
    updated_at: string;
    nodes: IntentNodeVNext[];
    edges: Array<{
        from: string;
        to: string;
        type: string;
    }>;
}
export interface DecisionProvenanceNode {
    decision_id: string;
    title: string;
    context: string;
    alternatives: string[];
    selected: string;
    reason: string;
    tradeoffs: string[];
    impact_scope: string[];
    linked_intent: string;
    reversibility: 'low' | 'medium' | 'high' | 'unknown';
    timestamp: string;
    cognition?: CognitionConfidenceMeta;
}
export interface DecisionProvenanceGraph {
    schema: typeof DECISION_PROVENANCE_SCHEMA;
    updated_at: string;
    nodes: DecisionProvenanceNode[];
    edges: Array<{
        from: string;
        to: string;
        relation: string;
    }>;
}
export interface WhyFeatureEntry {
    feature: string;
    why: string;
    problem: string;
    value: string;
    origin_decision: string;
    linked_intent: string;
}
export interface WhyLayerArtifact {
    schema: typeof WHY_LAYER_SCHEMA;
    updated_at: string;
    features: WhyFeatureEntry[];
}
export type EvolutionEventType = 'state_change' | 'intent_change' | 'decision' | 'refactor' | 'milestone';
export interface ProjectEvolutionEvent {
    event_id: string;
    timestamp: number;
    event_type: EvolutionEventType;
    entity_id: string;
    before_snapshot: Record<string, unknown>;
    after_snapshot: Record<string, unknown>;
    /** v1.1.3 spec aliases */
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    trigger_source: 'IDE' | 'MCP' | 'CLI' | 'Git';
    /** v1.1.3 spec alias for trigger_source */
    source?: 'IDE' | 'MCP' | 'CLI' | 'Git';
    linked_intent?: string;
    linked_decision?: string;
    impact_summary?: string;
}
export interface ProjectEvolutionTimeline {
    schema: typeof PROJECT_EVOLUTION_SCHEMA;
    updated_at: string;
    events: ProjectEvolutionEvent[];
}
export interface ImpactedNode {
    module: string;
    impact_level: number;
}
export interface ImpactGraphEntry {
    source_entity: string;
    change_type: string;
    impacted_nodes: ImpactedNode[];
    /** v1.1.3 — Affected nodes / total nodes */
    impact_radius: number;
    /** @deprecated use impact_radius */
    blast_radius: number;
    /** v1.1.3 — max graph traversal depth */
    dependency_depth: number;
    /** descriptive coupling score (not prediction) */
    risk_score: number;
    updated_at: string;
}
export interface ImpactGraphArtifact {
    schema: typeof IMPACT_GRAPH_SCHEMA;
    updated_at: string;
    entries: ImpactGraphEntry[];
}
export interface ConfidenceSignalSources {
    change_frequency: number;
    decision_volatility: number;
    intent_changes: number;
}
/** @deprecated use ConfidenceSignalSources */
export type StabilitySignalSources = ConfidenceSignalSources & {
    git_frequency?: number;
    decision_rewrites?: number;
};
export interface ConfidenceIndexEntry {
    entity_id: string;
    confidence_score: number;
    category: ConfidenceCategory;
    freshness: 'recent' | 'historical';
    signal_sources: ConfidenceSignalSources;
    updated_at: string;
}
export interface ConfidenceIndexArtifact {
    schema: typeof CONFIDENCE_INDEX_SCHEMA;
    updated_at: string;
    entities: ConfidenceIndexEntry[];
}
/** @deprecated use ConfidenceIndexEntry */
export interface StabilityIndexEntry {
    entity_id: string;
    confidence: number;
    stability_state: ConfidenceCategory;
    freshness: 'recent' | 'historical';
    signal_sources: StabilitySignalSources;
    stability_score: number;
    trend?: string;
    updated_at: string;
}
/** @deprecated use ConfidenceIndexArtifact */
export interface StabilityIndexArtifact {
    schema: typeof CONFIDENCE_INDEX_SCHEMA;
    updated_at: string;
    entities: StabilityIndexEntry[];
}
export interface ProvenanceChainLink {
    layer: 'why' | 'decision' | 'intent' | 'timeline';
    entity_id: string;
    label: string;
    timestamp?: string;
}
export interface ProvenanceChainEntry {
    query_anchor: string;
    chain: ProvenanceChainLink[];
    updated_at: string;
}
export interface ProvenanceChainArtifact {
    schema: typeof PROVENANCE_CHAIN_SCHEMA;
    updated_at: string;
    entries: ProvenanceChainEntry[];
}
export interface EvolutionGraphNode {
    node_id: string;
    label: string;
    stage: string;
    linked_intent?: string;
    linked_decision?: string;
}
export interface EvolutionGraphChain {
    chain_id: string;
    topic: string;
    nodes: EvolutionGraphNode[];
    updated_at: string;
}
export interface EvolutionGraphArtifact {
    schema: typeof EVOLUTION_GRAPH_SCHEMA;
    updated_at: string;
    chains: EvolutionGraphChain[];
}
export interface ProjectIntelligenceRepositoryState {
    schema: typeof PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA;
    updated_at: string;
    last_signal_source: string;
    /** Contorium runtime version */
    repository_version: string;
    /** Artifact format version */
    schema_version: string;
    pipeline_version: 2;
    dimensions: {
        timeline_events: number;
        impact_entries: number;
        confidence_entities: number;
        provenance_entries: number;
        evolution_chains: number;
    };
    health?: ProjectIntelligenceHealthMetrics;
}
export interface ProjectIntelligenceHealthMetrics {
    intelligence_completeness: number;
    decision_coverage: number;
    intent_linkage: number;
    provenance_coverage: number;
    knowledge_coverage: number;
    health_score: number;
    health_category: 'Excellent' | 'Healthy' | 'Incomplete' | 'Fragmented';
}
export interface ProjectIntelligenceHealth {
    schema: typeof PROJECT_INTELLIGENCE_HEALTH_SCHEMA;
    updated_at: string;
    metrics: ProjectIntelligenceHealthMetrics;
    coverage_detail?: {
        covered_modules: string[];
        total_modules: string[];
    };
}
export interface SchemaValidationIssue {
    artifact: string;
    field?: string;
    message: string;
}
export interface ProjectIntelligenceValidation {
    schema: typeof PROJECT_INTELLIGENCE_VALIDATION_SCHEMA;
    updated_at: string;
    valid: boolean;
    issues: SchemaValidationIssue[];
}
/** @deprecated use ProjectIntelligenceRepositoryState */
export interface CognitiveEngineState {
    schema: typeof PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA;
    updated_at: string;
    last_signal_source: string;
    pipeline_version: 1;
    dimensions: {
        timeline_events: number;
        impact_entries: number;
        stability_entities: number;
        confidence_entities?: number;
        provenance_entries?: number;
        evolution_chains?: number;
    };
}
export interface ProjectIntelligenceSnapshot {
    schema: typeof PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA;
    updated_at: string;
    layers: {
        state_hash?: string;
        active_intents: number;
        active_decisions: number;
        timeline_events: number;
        impact_blast_radius?: number;
        confidence_score?: number;
    };
    summary: string;
}
/** @deprecated use ProjectIntelligenceSnapshot */
export interface CognitiveSnapshot {
    schema: typeof PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA;
    updated_at: string;
    layers: {
        state_hash?: string;
        active_intents: number;
        active_decisions: number;
        timeline_events: number;
        impact_blast_radius?: number;
        stability_score?: number;
        confidence_score?: number;
    };
    summary: string;
}
//# sourceMappingURL=types.d.ts.map