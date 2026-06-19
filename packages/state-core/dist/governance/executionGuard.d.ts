import type { ExecutionGuardResult, GuardAction, PreActionCheckInput } from './types.js';
/**
 * V3.2 Execution Guard — change-aware risk engine (not path-only alerts).
 */
export declare function preActionCheck(workspaceRoot: string, input: PreActionCheckInput): Promise<ExecutionGuardResult>;
export declare function guardActionLabel(action: GuardAction): string;
//# sourceMappingURL=executionGuard.d.ts.map