import type { ProjectIntelligenceHealthMetrics } from '../types.js';

export type HealthCategoryLabel = 'Excellent' | 'Healthy' | 'Incomplete' | 'Fragmented';

/** Frozen formula — Project Intelligence Health (v1.1.3) */
export const HEALTH_SCORE_WEIGHTS = {
  intelligence_completeness: 0.35,
  decision_coverage: 0.25,
  intent_linkage: 0.2,
  provenance_coverage: 0.2,
} as const;

export function computeHealthScore(metrics: Omit<ProjectIntelligenceHealthMetrics, 'health_score' | 'health_category' | 'knowledge_coverage'>): number {
  const score =
    HEALTH_SCORE_WEIGHTS.intelligence_completeness * metrics.intelligence_completeness +
    HEALTH_SCORE_WEIGHTS.decision_coverage * metrics.decision_coverage +
    HEALTH_SCORE_WEIGHTS.intent_linkage * metrics.intent_linkage +
    HEALTH_SCORE_WEIGHTS.provenance_coverage * metrics.provenance_coverage;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

export function classifyHealthScore(score: number): HealthCategoryLabel {
  if (score >= 0.85) {
    return 'Excellent';
  }
  if (score >= 0.7) {
    return 'Healthy';
  }
  if (score >= 0.5) {
    return 'Incomplete';
  }
  return 'Fragmented';
}
