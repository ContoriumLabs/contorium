import type { DecisionLifecycleMeta, VerificationType } from './types.js';
export interface LifecycleVerifyInput {
    by?: string;
    type?: VerificationType;
    /** Human-readable reason the decision still holds (优化.md §10). */
    reason?: string;
    /** Evidence supporting revalidation. */
    evidence?: string;
}
/** Apply verify semantics: reset owner-change decay, record evidence (优化.md §10). */
export declare function applyLifecycleVerification(existing: DecisionLifecycleMeta, input?: LifecycleVerifyInput): DecisionLifecycleMeta;
//# sourceMappingURL=verifyLifecycle.d.ts.map