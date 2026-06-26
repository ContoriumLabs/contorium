import { detectDecisionContradictions } from './decisionConsistency.js';
import type { AdrRecord } from './types.js';
export declare function getDecisionCenter(workspaceRoot: string): Promise<{
    decisions: AdrRecord[];
    contradictions: ReturnType<typeof detectDecisionContradictions>;
    formatted: string[];
}>;
//# sourceMappingURL=decisionCenter.d.ts.map