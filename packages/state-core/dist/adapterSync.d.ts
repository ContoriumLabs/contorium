import type { AdapterKind, StateEngineMode, StateSourceMetadata } from './types.js';
export interface AdapterSyncResult {
    mode: StateEngineMode;
    /** true when .contora/state.json did not exist before this call */
    created: boolean;
    /** true when state.json or artifacts were written */
    updated: boolean;
    source?: StateSourceMetadata;
    eventCount: number;
}
/**
 * Shared one-shot sync for MCP / CLI adapters (runtime adapter pattern).
 * Scans workspace, merges into state.json, optionally rebuilds L4 when no events.
 */
export declare function syncWorkspaceState(workspaceRoot: string, writer: AdapterKind, options?: {
    forceArtifacts?: boolean;
}): Promise<AdapterSyncResult>;
/** Read-only status for CLI `status` / IDE-less inspection. */
export declare function readWorkspaceStatus(workspaceRoot: string): Promise<{
    workspaceRoot: string;
    hasState: boolean;
    mode: StateEngineMode | 'unknown';
    source?: StateSourceMetadata;
    eventCount: number;
    gitWorking: number;
    gitStaged: number;
    currentTask: string;
}>;
//# sourceMappingURL=adapterSync.d.ts.map