/** V3.1 Project Cognitive Graph — Intent → Module → File → Function */
export declare const KNOWLEDGE_SCHEMA_VERSION = "1";
export declare const KNOWLEDGE_ENGINE_VERSION = "3.1.0";
export type KnowledgeNodeType = 'intent' | 'module' | 'file' | 'function' | 'class';
/** Version Layer — backward/forward compatible graph metadata. */
export interface GraphMetadata {
    version: string;
    schemaVersion: string;
    closureVersion?: string;
    generatedAt: number;
    workspaceId: string;
    graphBuildId: string;
    sourceVersion: string;
    rebuildTrigger?: string;
    lastCommitHash?: string;
}
export interface KnowledgeNode {
    id: string;
    type: KnowledgeNodeType;
    name: string;
    path?: string;
    metadata?: Record<string, unknown>;
    updatedAt: number;
}
export type KnowledgeEdgeType = 'contains' | 'calls' | 'depends_on' | 'implements' | 'supports_intent';
/** Confidence Layer — every edge carries AI-trust score. */
export interface KnowledgeEdge {
    source: string;
    target: string;
    type: KnowledgeEdgeType;
    weight: number;
    confidence: number;
}
export interface IntentFunctionMapping {
    intentId: string;
    functionId: string;
    score: number;
    confidence: number;
    signals: string[];
}
export interface ReasonTraceItem {
    targetId: string;
    targetName: string;
    targetType: KnowledgeNodeType;
    reasons: string[];
    editCount: number;
    dependencyCount: number;
    linkedIntent?: string;
    confidence?: number;
}
/** Hotspot Layer — activity (not importance). Lifecycle: active → cooling → stale. */
export type HotspotLifecycle = 'active' | 'cooling' | 'stale';
export interface HotspotNode {
    id: string;
    type: 'hotspot';
    targetId: string;
    targetName: string;
    targetKind: 'file' | 'function';
    score: number;
    lifecycle: HotspotLifecycle;
    editFrequency: number;
    gitActivity: number;
    intentLinks: number;
    dependencyCount: number;
}
/** Snapshot Layer — compact cognitive summary for AI Handoff. */
export interface KnowledgeSnapshot {
    generatedAt: number;
    topIntents: string[];
    topHotspots: string[];
    topFunctions: string[];
    nextActions: string[];
    graphSummary: {
        nodeCount: number;
        edgeCount: number;
        mappingCount: number;
        avgConfidence: number;
    };
}
export interface KnowledgeGraphTreeNode {
    id: string;
    type: KnowledgeNodeType;
    name: string;
    path?: string;
    confidence?: number;
    expanded?: boolean;
    children: KnowledgeGraphTreeNode[];
}
export interface ProjectKnowledgeGraph {
    meta: GraphMetadata;
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    /** Canonical mappings only (confidence >= 0.7). */
    intentMappings: IntentFunctionMapping[];
    /** Cortex-only weak mappings (confidence < 0.7) — never in snapshot/handoff. */
    inferenceMappings: IntentFunctionMapping[];
    reasonTraces: ReasonTraceItem[];
    intentTrees: KnowledgeGraphTreeNode[];
    hotspots: HotspotNode[];
    snapshot: KnowledgeSnapshot;
}
/** Legacy shape (pre meta) — normalized on read. */
export interface LegacyProjectKnowledgeGraph {
    version: 1;
    generatedAt: number;
    nodes: KnowledgeNode[];
    edges: Array<Omit<KnowledgeEdge, 'confidence'> & {
        confidence?: number;
    }>;
    intentMappings: Array<Omit<IntentFunctionMapping, 'confidence'> & {
        confidence?: number;
    }>;
    reasonTraces: ReasonTraceItem[];
    intentTrees: KnowledgeGraphTreeNode[];
}
//# sourceMappingURL=types.d.ts.map