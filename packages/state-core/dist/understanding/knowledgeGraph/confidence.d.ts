import type { IntentFunctionMapping, KnowledgeEdge } from './types.js';
export declare function clampConfidence(value: number): number;
/**
 * Unified confidence (V3.1 Closure):
 * clamp(0.5 * semantic + 0.3 * temporal + 0.2 * git, 0, 1)
 */
export declare function computeUnifiedConfidence(args: {
    semanticSimilarity: number;
    temporalRecency: number;
    gitActivity: number;
}): number;
export declare function isCanonicalConfidence(confidence: number): boolean;
export declare function splitMappingsByCanonicalThreshold(mappings: IntentFunctionMapping[]): {
    canonical: IntentFunctionMapping[];
    inference: IntentFunctionMapping[];
};
/** Drop supports_intent edges whose confidence is below canonical threshold. */
export declare function filterCanonicalEdges(edges: KnowledgeEdge[]): KnowledgeEdge[];
export declare function confidenceBandLabel(confidence: number): string;
//# sourceMappingURL=confidence.d.ts.map