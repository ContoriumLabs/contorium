import { readStateJson } from '../bootstrap/bootstrapState.js';
import { updateCognitiveFromInput } from './cognitiveLoop.js';
import { preActionCheck } from './executionGuard.js';
import { getGovernanceSummary } from './governanceEngine.js';
import { readCognitiveIntent, readCognitiveState } from './store.js';
import type { ExecutionGuardResult, PreActionCheckInput } from './types.js';
/** V3.2 internal API — not HTTP; shared by MCP / CLI / IDE adapters. */
export declare function analyzeProject(workspaceRoot: string): Promise<{
    workspaceRoot: string;
    governance: Awaited<ReturnType<typeof getGovernanceSummary>>;
    cognitive: {
        state: Awaited<ReturnType<typeof readCognitiveState>>;
        intent: Awaited<ReturnType<typeof readCognitiveIntent>>;
    };
    handoff: {
        goal?: string;
        current_focus?: string;
        risk?: string;
    };
}>;
export declare function validateChange(workspaceRoot: string, input: PreActionCheckInput): Promise<ExecutionGuardResult>;
export declare function getProjectState(workspaceRoot: string): Promise<{
    workspaceRoot: string;
    bootstrap: Awaited<ReturnType<typeof readStateJson>>;
    cognitive: Awaited<ReturnType<typeof readCognitiveState>>;
    intent: Awaited<ReturnType<typeof readCognitiveIntent>>;
    governance_ready: boolean;
    recent_guard_checks: number;
}>;
export declare function refreshProjectCognitive(workspaceRoot: string): Promise<void>;
export { updateCognitiveFromInput, preActionCheck };
//# sourceMappingURL=internalApi.d.ts.map