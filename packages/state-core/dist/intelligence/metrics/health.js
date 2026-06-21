"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEALTH_SCORE_WEIGHTS = void 0;
exports.computeHealthScore = computeHealthScore;
exports.classifyHealthScore = classifyHealthScore;
/** Frozen formula — Project Intelligence Health (v1.1.3) */
exports.HEALTH_SCORE_WEIGHTS = {
    intelligence_completeness: 0.35,
    decision_coverage: 0.25,
    intent_linkage: 0.2,
    provenance_coverage: 0.2,
};
function computeHealthScore(metrics) {
    const score = exports.HEALTH_SCORE_WEIGHTS.intelligence_completeness * metrics.intelligence_completeness +
        exports.HEALTH_SCORE_WEIGHTS.decision_coverage * metrics.decision_coverage +
        exports.HEALTH_SCORE_WEIGHTS.intent_linkage * metrics.intent_linkage +
        exports.HEALTH_SCORE_WEIGHTS.provenance_coverage * metrics.provenance_coverage;
    return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}
function classifyHealthScore(score) {
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
