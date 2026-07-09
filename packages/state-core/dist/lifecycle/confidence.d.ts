import type { AdrRecord } from '../cil/types.js';
import type { DecisionLifecycleMeta, KnowledgeConfidenceDimensions } from './types.js';
export declare function computeDecisionConfidence(adr: AdrRecord, meta: DecisionLifecycleMeta, conflictRefs: string[], freshnessScore: number, decayPenalty?: number): KnowledgeConfidenceDimensions;
//# sourceMappingURL=confidence.d.ts.map