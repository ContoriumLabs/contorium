import {
  CONFIDENCE_WEIGHT_GIT,
  CONFIDENCE_WEIGHT_SEMANTIC,
  CONFIDENCE_WEIGHT_TEMPORAL,
  GRAPH_CANONICAL_MIN_CONFIDENCE,
} from './closureConstants.js';
import type { IntentFunctionMapping, KnowledgeEdge } from './types.js';

export function clampConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

/**
 * Unified confidence (V3.1 Closure):
 * clamp(0.5 * semantic + 0.3 * temporal + 0.2 * git, 0, 1)
 */
export function computeUnifiedConfidence(args: {
  semanticSimilarity: number;
  temporalRecency: number;
  gitActivity: number;
}): number {
  return clampConfidence(
    CONFIDENCE_WEIGHT_SEMANTIC * args.semanticSimilarity +
      CONFIDENCE_WEIGHT_TEMPORAL * args.temporalRecency +
      CONFIDENCE_WEIGHT_GIT * args.gitActivity,
  );
}

export function isCanonicalConfidence(confidence: number): boolean {
  return confidence >= GRAPH_CANONICAL_MIN_CONFIDENCE;
}

export function splitMappingsByCanonicalThreshold(
  mappings: IntentFunctionMapping[],
): { canonical: IntentFunctionMapping[]; inference: IntentFunctionMapping[] } {
  const canonical: IntentFunctionMapping[] = [];
  const inference: IntentFunctionMapping[] = [];
  for (const m of mappings) {
    if (isCanonicalConfidence(m.confidence)) {
      canonical.push(m);
    } else {
      inference.push(m);
    }
  }
  return { canonical, inference };
}

/** Drop supports_intent edges whose confidence is below canonical threshold. */
export function filterCanonicalEdges(edges: KnowledgeEdge[]): KnowledgeEdge[] {
  return edges.filter(
    (e) => e.type !== 'supports_intent' || isCanonicalConfidence(e.confidence),
  );
}

export function confidenceBandLabel(confidence: number): string {
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
