import type { HotspotNode, IntentFunctionMapping, KnowledgeEdge, KnowledgeNode } from './types.js';
export interface HotspotBuildInput {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    intentMappings: IntentFunctionMapping[];
    editCounts: Map<string, number>;
    gitFrequency: Map<string, number>;
    now: number;
    max?: number;
}
/** Hotspot Layer — activity scoring; AND gate + lifecycle (Closure §8). */
export declare function buildHotspots(input: HotspotBuildInput): HotspotNode[];
//# sourceMappingURL=hotspotBuilder.d.ts.map