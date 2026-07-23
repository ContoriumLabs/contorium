import type { ChangeEvent } from '../cil/changeEventEngine.js';
import type { AssumptionGraphArtifact } from './assumptionGraph.js';
import type { DecisionDependencyGraphArtifact } from './decisionDependencyGraph.js';
import type { InvalidationChainLink, ValiditySignal } from './types.js';
export type DecisionImpactLevel = 'low' | 'medium' | 'high';
export interface DecisionImpactResult {
    decision_id: string;
    impact: DecisionImpactLevel;
    reason: string;
    chain: InvalidationChainLink[];
    /** Optional upgraded signal derived from propagation. */
    signal?: ValiditySignal;
}
/** Propagate change events through dependency graph → reason chains (优化.md §7–8). */
export declare function computeDecisionImpacts(events: ChangeEvent[], depGraph: DecisionDependencyGraphArtifact, assumptionGraph: AssumptionGraphArtifact): DecisionImpactResult[];
export declare function formatDecisionWhyChain(chain: InvalidationChainLink[]): string[];
//# sourceMappingURL=impactEngine.d.ts.map