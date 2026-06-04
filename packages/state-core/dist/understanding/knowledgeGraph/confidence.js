"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampConfidence = clampConfidence;
exports.computeUnifiedConfidence = computeUnifiedConfidence;
exports.isCanonicalConfidence = isCanonicalConfidence;
exports.splitMappingsByCanonicalThreshold = splitMappingsByCanonicalThreshold;
exports.filterCanonicalEdges = filterCanonicalEdges;
exports.confidenceBandLabel = confidenceBandLabel;
const closureConstants_js_1 = require("./closureConstants.js");
function clampConfidence(value) {
    return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}
/**
 * Unified confidence (V3.1 Closure):
 * clamp(0.5 * semantic + 0.3 * temporal + 0.2 * git, 0, 1)
 */
function computeUnifiedConfidence(args) {
    return clampConfidence(closureConstants_js_1.CONFIDENCE_WEIGHT_SEMANTIC * args.semanticSimilarity +
        closureConstants_js_1.CONFIDENCE_WEIGHT_TEMPORAL * args.temporalRecency +
        closureConstants_js_1.CONFIDENCE_WEIGHT_GIT * args.gitActivity);
}
function isCanonicalConfidence(confidence) {
    return confidence >= closureConstants_js_1.GRAPH_CANONICAL_MIN_CONFIDENCE;
}
function splitMappingsByCanonicalThreshold(mappings) {
    const canonical = [];
    const inference = [];
    for (const m of mappings) {
        if (isCanonicalConfidence(m.confidence)) {
            canonical.push(m);
        }
        else {
            inference.push(m);
        }
    }
    return { canonical, inference };
}
/** Drop supports_intent edges whose confidence is below canonical threshold. */
function filterCanonicalEdges(edges) {
    return edges.filter((e) => e.type !== 'supports_intent' || isCanonicalConfidence(e.confidence));
}
function confidenceBandLabel(confidence) {
    if (confidence >= 0.9) {
        return 'strong';
    }
    if (confidence >= 0.7) {
        return 'high';
    }
    if (confidence >= 0.5) {
        return 'weak';
    }
    return 'excluded';
}
