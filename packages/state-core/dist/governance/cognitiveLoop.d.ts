import type { CognitiveGraph, CognitiveIntent, ProjectCognitiveState, UserRequestOverlay } from './types.js';
export interface CognitiveUpdateResult {
    updated: boolean;
    user_request?: UserRequestOverlay;
    /** Derived projection after sync — read-only snapshot. */
    state?: ProjectCognitiveState;
    intent?: CognitiveIntent;
    graph?: CognitiveGraph;
}
/**
 * Record user intent as overlay only, then rebuild derived cognitive/*.json.
 * V3.1 handoff remains raw execution context; cognitive/ is derived projection.
 */
export declare function updateCognitiveFromInput(workspaceRoot: string, userInput: string): Promise<CognitiveUpdateResult>;
//# sourceMappingURL=cognitiveLoop.d.ts.map