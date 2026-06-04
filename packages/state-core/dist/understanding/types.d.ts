/** V3.1 Project Understanding — 3+1 artifacts: graph, change, handoff, timeline. */
export type GraphNodeKind = 'function' | 'class' | 'module' | 'import';
export interface GraphNode {
    id: string;
    kind: GraphNodeKind;
    name: string;
    file: string;
    line?: number;
}
export type GraphEdgeKind = 'calls' | 'imports' | 'contains';
export interface GraphEdge {
    from: string;
    to: string;
    kind: GraphEdgeKind;
}
export interface ProjectGraph {
    version: 2;
    generatedAt: number;
    scope: 'change-neighborhood';
    nodes: GraphNode[];
    edges: GraphEdge[];
}
export type RiskLevel = 'low' | 'medium' | 'high';
export type ChangeType = 'added' | 'modified' | 'removed' | 'unknown';
export interface KeyChange {
    symbol: string;
    kind: 'function' | 'class' | 'file';
    change_type: ChangeType;
}
export interface ChangeArtifact {
    version: 2;
    generatedAt: number;
    changed_files: string[];
    key_changes: KeyChange[];
}
export type HandoffActionKind = 'refactor' | 'fix' | 'extend' | 'review' | 'continue';
export interface HandoffNextAction {
    action: HandoffActionKind;
    target: string;
    reason: string;
}
export interface HandoffImpactSummary {
    risk: RiskLevel;
    affected_modules: string[];
    affected_functions: string[];
    details: string[];
}
/** V3.1 — sole AI entry point; intent + impact merged here. */
export interface HandoffArtifact {
    version: 2;
    generatedAt: number;
    goal: string;
    current_focus: string;
    key_changes: KeyChange[];
    impact_summary: HandoffImpactSummary;
    next_actions: HandoffNextAction[];
    context_graph_refs: string[];
    summary: string;
}
export interface TimelineSymbolChange {
    symbol: string;
    change: string;
}
export interface TimelineEntry {
    commit: string;
    timestamp: number;
    type: 'modify' | 'add' | 'delete' | 'rename';
    file: string;
    changes: TimelineSymbolChange[];
    impact_level: RiskLevel;
    linked_graph_nodes: string[];
}
export interface FileTimeline {
    file: string;
    history: TimelineEntry[];
}
export interface ProjectTimeline {
    version: 1;
    generatedAt: number;
    files: FileTimeline[];
    /** Last N commits flattened for quick AI scan */
    recent: TimelineEntry[];
}
/** Internal — used during pipeline, not persisted as separate artifact. */
export interface ImpactAnalysis {
    affected_functions: string[];
    affected_modules: string[];
    risk: RiskLevel;
    details: string[];
}
export interface IntentFusion {
    focus: string;
    confidence: number;
    signals: string[];
}
export declare const UNDERSTANDING_VERSION: 2;
/** @deprecated V3.0 standalone artifact — read from handoff in V3.1 */
export interface ImpactArtifact {
    version: 1;
    generatedAt: number;
    affected_functions: string[];
    affected_modules: string[];
    risk: RiskLevel;
    risk_level: RiskLevel;
    details: string[];
}
/** @deprecated V3.0 standalone artifact — read from handoff in V3.1 */
export interface IntentArtifact {
    version: 1;
    generatedAt: number;
    intent: string;
    confidence: number;
    signals: string[];
}
/** @deprecated V3.0 handoff shape — normalized on read */
export interface HandoffArtifactV1 {
    version: 1;
    generatedAt: number;
    goal: string;
    intent: string;
    changed: {
        changedFiles: string[];
        changed_functions: string[];
        changed_classes: string[];
    };
    impact: {
        affected_functions: string[];
        affected_modules: string[];
        risk_level: RiskLevel;
        details: string[];
    };
    next_actions: string[];
    summary: string;
}
export type AnyHandoffArtifact = HandoffArtifact | HandoffArtifactV1;
//# sourceMappingURL=types.d.ts.map