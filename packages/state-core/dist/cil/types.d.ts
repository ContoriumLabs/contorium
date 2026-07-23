/**
 * Cognitive Interaction Layer (CIL) v3 — user-facing cognition over AI PIL storage.
 * @see docs/CIL.md
 */
export declare const COGNITIVE_EVENT_SCHEMA: "cognitive_event.v1";
export declare const ADR_RECORD_SCHEMA: "adr.v2";
export declare const CIL_INDEX_SCHEMA: "cil_index.v1";
export declare const DECISION_GRAPH_SCHEMA: "decision_graph.v1";
export declare const PROJECT_SNAPSHOT_SCHEMA: "project_snapshot.v2";
export declare const KNOWLEDGE_ENTITY_SCHEMA: "knowledge_entity.v1";
export declare const COGNITIVE_HEALTH_SCHEMA: "cognitive_health.v1";
/** Final CIL intent taxonomy (Query Router). */
export type CilIntent = 'action' | 'decision' | 'direction' | 'history' | 'state' | 'story' | 'debug' | 'time_travel' | 'entity';
export type KernelMode = 'ask' | 'next' | 'story' | 'sync' | 'history' | 'decisions' | 'snapshot' | 'health' | 'entity' | 'essence' | 'replay' | 'dna' | 'questions' | 'lifecycle' | 'review';
export type CognitiveEventSource = 'git' | 'ide' | 'cli' | 'mcp' | 'agent' | 'manual';
export type FreshnessLabel = 'fresh' | 'verified' | 'stale' | 'unknown';
export type AdrStatus = 'proposed' | 'accepted' | 'implemented' | 'deprecated' | 'superseded' | 'rejected';
/** CIL sole fact source identifier for projection artifacts. */
export type CilTruthSource = 'cognitive_events';
export interface CilProjectionMeta {
    projection_of: CilTruthSource;
    derived_from: string[];
}
export interface CognitiveEvent {
    schema: typeof COGNITIVE_EVENT_SCHEMA;
    id: string;
    timestamp: string;
    title: string;
    summary: string;
    files: string[];
    decision?: string;
    why?: string;
    impact: string[];
    confidence?: number;
    freshness: FreshnessLabel;
    source: CognitiveEventSource[];
    linked_decision_id?: string;
    linked_intent?: string;
    provenance?: string[];
    version?: string;
    previous?: string;
    next?: string;
    snapshot_id?: string;
}
export interface AdrRecord {
    schema: typeof ADR_RECORD_SCHEMA;
    id: string;
    title: string;
    status: AdrStatus;
    date: string;
    reason: string;
    alternatives: string[];
    risk: 'low' | 'medium' | 'high';
    related_events: string[];
    /** Decision graph edges — related ADR / event ids */
    edges: string[];
    effective_range?: {
        from: string;
        to?: string;
    };
    freshness: FreshnessLabel;
    last_verified?: string;
    superseded_by?: string;
}
export interface DecisionGraphNode {
    id: string;
    title: string;
    status: AdrStatus;
    reason: string;
    edges: string[];
    effective_range?: {
        from: string;
        to?: string;
    };
}
export interface DecisionGraphArtifact {
    schema: typeof DECISION_GRAPH_SCHEMA;
    updated_at: string;
    nodes: DecisionGraphNode[];
    projection_of: CilTruthSource;
    derived_from: string[];
}
export interface ActionConstraints {
    risk: 'low' | 'medium' | 'high';
    requires_confirmation: boolean;
    /** CIL never executes — suggestions only */
    is_executable: false;
}
export interface NextActionItem {
    task: string;
    reason: string;
    confidence: number;
    source: 'intent' | 'focus' | 'decision' | 'impact' | 'handoff';
    constraints: ActionConstraints;
}
export interface ProjectSnapshotState {
    focus?: string;
    state_hash?: string;
    current_task?: string;
}
export interface ProjectSnapshotRecord {
    schema: typeof PROJECT_SNAPSHOT_SCHEMA;
    id: string;
    version: string;
    timestamp: string;
    state: ProjectSnapshotState;
    events: CognitiveEvent[];
    decisions: AdrRecord[];
    summary: string;
    projection_of: CilTruthSource;
    derived_from: string[];
}
/** Module history = read-only projection of cognitive events (not a separate truth source). */
export interface ModuleHistoryRecord {
    schema: 'module_history.v1';
    module: string;
    updated_at: string;
    projection_of: 'cognitive_events';
    events: Array<{
        date: string;
        title: string;
        why?: string;
        event_id: string;
    }>;
}
export interface CilIndexProjectionRef {
    path: string;
    updated_at: string;
}
export interface CognitiveEventIndex {
    schema: typeof CIL_INDEX_SCHEMA;
    updated_at: string;
    event_ids: string[];
    adr_ids: string[];
    /** Derived projection pointers (read-only overlays). */
    projections?: {
        lifecycle?: CilIndexProjectionRef & {
            score?: number;
            review_count?: number;
        };
        cognitive_health?: CilIndexProjectionRef & {
            score?: number;
        };
    };
}
export type HistoryRange = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'all';
export interface HistoryExplorerResult {
    range: HistoryRange;
    count: number;
    events: CognitiveEvent[];
    formatted: string[];
}
export interface BlastRadiusResult {
    node: string;
    blast_radius: number;
    criticality: 'low' | 'medium' | 'high';
    affected: string[];
    chain: string[];
    formatted: string[];
}
export interface ProjectJourneyStage {
    version: string;
    label: string;
    summary: string;
}
export interface KernelTraceStep {
    engine: string;
    phase: string;
    at: string;
}
export interface KernelInput {
    mode: KernelMode;
    query?: string;
    topic?: string;
    range?: HistoryRange;
    /** Time travel: historical = known then; retrospective = known now about then */
    perspective?: TimeTravelPerspective;
    context?: Record<string, unknown>;
}
export interface KernelOutput {
    intent: CilIntent | 'sync';
    result: unknown;
    trace: KernelTraceStep[];
}
export interface CilStructuredResponse {
    fact: string[];
    insight: string[];
    actions: NextActionItem[];
}
import type { DriftReport } from './pik/types.js';
export interface AskSemanticBundle {
    primary_intent: string;
    alignment_score: number;
    drift: DriftReport;
    recommended_next_focus: string[];
    pik_source: string;
    reasoning_trace: string[];
}
export interface AskProjectResult {
    question: string;
    intent: string;
    answer: string;
    data?: Record<string, unknown>;
    structured?: CilStructuredResponse;
    trace?: KernelTraceStep[];
    /** PIK + semantic fusion overlay (Ask v2). */
    semantic?: AskSemanticBundle;
}
export interface TransferStoryPayload {
    project_summary: string;
    current_goal: string;
    recent_decisions: string[];
    important_events: string[];
    pending_risks: string[];
    next_actions: string[];
    formatted_markdown: string;
}
/** Knowledge Graph — entity-centric links across CIL artifacts. */
export interface KnowledgeEntityRecord {
    schema: typeof KNOWLEDGE_ENTITY_SCHEMA;
    entity: string;
    updated_at: string;
    projection_of: CilTruthSource;
    derived_from: string[];
    events: string[];
    decisions: string[];
    modules: string[];
    snapshots: string[];
}
export interface KnowledgeEntityIndex {
    schema: 'knowledge_index.v1';
    updated_at: string;
    projection_of: CilTruthSource;
    entities: string[];
}
export interface DecisionContradiction {
    decision: string;
    decision_title: string;
    status: 'contradicted';
    by: string;
    by_title: string;
    reason: string;
}
export interface CognitiveHealthWarning {
    code: 'missing_why' | 'missing_decision' | 'stale_intent' | 'dead_focus' | 'orphan_event' | 'broken_graph' | 'decision_conflict' | 'stale_adr';
    message: string;
    severity: 'low' | 'medium' | 'high';
    refs?: string[];
}
export interface CognitiveHealthReport {
    schema: typeof COGNITIVE_HEALTH_SCHEMA;
    score: number;
    updated_at: string;
    projection_of: CilTruthSource;
    derived_from: string[];
    warnings: CognitiveHealthWarning[];
    formatted: string[];
}
export type TimeTravelPerspective = 'historical' | 'retrospective';
export interface TimeTravelResult {
    date: string;
    perspective: TimeTravelPerspective;
    snapshot: ProjectSnapshotRecord | null;
    focus?: string;
    decisions: AdrRecord[];
    events: CognitiveEvent[];
    retrospective_notes?: string[];
    formatted: string[];
}
export interface ProjectEssence {
    phases: string[];
    key_decisions: string[];
    current_focus: string;
    open_risks: string[];
    formatted_markdown: string;
}
export interface HandoffReplayStage {
    date: string;
    label: string;
    detail: string;
}
export interface HandoffReplayResult {
    stages: HandoffReplayStage[];
    formatted: string[];
}
export interface ProjectDna {
    architecture: string;
    memory: string;
    interaction: string;
    state: string;
    goal: string;
    formatted: string[];
    formatted_markdown: string;
}
export interface SuggestedQuestionsResult {
    questions: string[];
    formatted: string[];
}
//# sourceMappingURL=types.d.ts.map