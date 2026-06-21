import type { ProjectIntelligenceHealthMetrics } from '../types.js';
export type HealthCategoryLabel = 'Excellent' | 'Healthy' | 'Incomplete' | 'Fragmented';
/** Frozen formula — Project Intelligence Health (v1.1.3) */
export declare const HEALTH_SCORE_WEIGHTS: {
    readonly intelligence_completeness: 0.35;
    readonly decision_coverage: 0.25;
    readonly intent_linkage: 0.2;
    readonly provenance_coverage: 0.2;
};
export declare function computeHealthScore(metrics: Omit<ProjectIntelligenceHealthMetrics, 'health_score' | 'health_category' | 'knowledge_coverage'>): number;
export declare function classifyHealthScore(score: number): HealthCategoryLabel;
//# sourceMappingURL=health.d.ts.map