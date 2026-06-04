import type { HotspotNode, IntentFunctionMapping, KnowledgeEdge, KnowledgeNode, KnowledgeSnapshot } from './types.js';
export interface SnapshotBuildInput {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    intentMappings: IntentFunctionMapping[];
    hotspots: HotspotNode[];
    nextActions: string[];
    now: number;
}
/**
 * Snapshot Layer — compression projection from canonical graph only (Closure §9).
 * snapshot = compression(graph, weight); never a second truth source.
 */
export declare function buildKnowledgeSnapshot(input: SnapshotBuildInput): KnowledgeSnapshot;
/** Filter graph relations by minimum confidence (MCP / export projection). */
export declare function filterMappingsByConfidence(mappings: IntentFunctionMapping[], minConfidence: number): IntentFunctionMapping[];
//# sourceMappingURL=snapshotBuilder.d.ts.map