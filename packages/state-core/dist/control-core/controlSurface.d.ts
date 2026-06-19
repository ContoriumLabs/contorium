import type { AdapterKind } from '../types.js';
import { getProjectState } from '../governance/internalApi.js';
import type { ControlAnalyzeResult, ControlCheckResult, ControlExecuteInput, ControlExecuteResult, ControlGovernanceResult, ControlIntentResult } from './types.js';
import type { PreActionCheckInput } from '../governance/types.js';
/**
 * Contorium Control Surface — unified closed-loop entry for IDE / MCP / CLI.
 * Adapters call this layer; state-core remains the single truth engine.
 */
export declare class ContoriumControlSurface {
    readonly workspaceRoot: string;
    readonly source: AdapterKind;
    constructor(workspaceRoot: string, source: AdapterKind);
    private ctx;
    /** Ensure governance seed + lightweight sync (idempotent). */
    ensureReady(): Promise<{
        governance_initialized: boolean;
        synced: boolean;
    }>;
    getGovernance(): Promise<ControlGovernanceResult>;
    checkAction(input: PreActionCheckInput): Promise<ControlCheckResult>;
    updateIntent(userInput: string): Promise<ControlIntentResult>;
    analyze(): Promise<ControlAnalyzeResult>;
    getState(): Promise<Awaited<ReturnType<typeof getProjectState>>>;
    /**
     * Full closed loop: governance check → optional audit → cognitive feedback sync.
     * Intent → State → Governance → Execution feedback
     */
    executeAction(input: ControlExecuteInput): Promise<ControlExecuteResult>;
}
export declare function createControlSurface(workspaceRoot: string, source: AdapterKind): ContoriumControlSurface;
//# sourceMappingURL=controlSurface.d.ts.map