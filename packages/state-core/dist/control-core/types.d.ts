import type { AdapterKind } from '../types.js';
import type { CognitiveUpdateResult } from '../governance/cognitiveLoop.js';
import type { ExecutionGuardResult, PreActionCheckInput } from '../governance/types.js';
/** Unified control surface — all adapters route through this layer. */
export interface ControlSurfaceContext {
    workspaceRoot: string;
    source: AdapterKind;
}
export interface ControlGovernanceResult extends ControlSurfaceContext {
    loop: 'governance';
    governance: Awaited<ReturnType<typeof import('../governance/governanceEngine.js').getGovernanceSummary>>;
}
export interface ControlCheckResult extends ControlSurfaceContext {
    loop: 'check';
    guard: ExecutionGuardResult;
    label: string;
}
export interface ControlIntentResult extends ControlSurfaceContext {
    loop: 'intent';
    update: CognitiveUpdateResult;
}
export interface ControlAnalyzeResult extends ControlSurfaceContext {
    loop: 'analyze';
    snapshot: Awaited<ReturnType<typeof import('../governance/internalApi.js').analyzeProject>>;
}
export interface ControlExecuteResult extends ControlSurfaceContext {
    loop: 'execute';
    allowed: boolean;
    guard: ExecutionGuardResult;
    label: string;
    tracked: boolean;
    change_id?: string;
    feedback: {
        cognitive_synced: boolean;
        governance_ready: boolean;
    };
}
export interface ControlExecuteInput extends PreActionCheckInput {
    /** Write change-log entry (default true for execute loop). */
    audit?: boolean;
    /** Adapter strict mode — block confirm without user_confirmed. */
    strict?: boolean;
}
//# sourceMappingURL=types.d.ts.map