import type { ChangeRecord, PreActionCheckInput, RiskSeverity } from './types.js';
import type { ExecutionGuardResult } from './types.js';
export interface ValidateAndTrackResult {
    guard: ExecutionGuardResult;
    /** @deprecated use guard.allow */
    validation: {
        status: string;
        reason: string;
        risk_level: RiskSeverity;
    };
    recorded: boolean;
    change_id?: string;
    blocked: boolean;
}
/**
 * V3.2 Lightweight Guard + change log (no approval workflow).
 */
export declare function validateAndTrackChange(workspaceRoot: string, action: PreActionCheckInput, source?: string): Promise<ValidateAndTrackResult>;
export declare function listRecentChanges(workspaceRoot: string, limit?: number): Promise<ChangeRecord[]>;
//# sourceMappingURL=changeTracker.d.ts.map