/** Tool-agnostic workspace facts (filesystem is source of truth). */
export type StateEngineMode = 'event-driven' | 'scan-driven' | 'merged';
export type AdapterKind = 'ide' | 'mcp' | 'cli';
export interface StateSourceMetadata {
    mode: StateEngineMode;
    lastWriter: AdapterKind;
    /** ISO-8601 timestamp */
    lastUpdated: string;
}
export interface WorkspaceScanFacts {
    workspaceRoot: string;
    scannedAt: number;
    topLevelModules: string[];
    recentFiles: string[];
    gitStaged: string[];
    gitWorking: string[];
    readmeHint?: string;
    isGitRepo: boolean;
}
/** Minimal state.json shape — backward compatible; `source` is v2.2 additive. */
export interface BootstrapStateJson {
    sessionId: string;
    currentTask: string;
    openFiles: string[];
    recentFiles: string[];
    gitStaged: string[];
    gitWorking: string[];
    notes: string;
    lastUpdated: number;
    source?: StateSourceMetadata;
}
export interface DualModeInput {
    mode: StateEngineMode;
    state: BootstrapStateJson;
    eventCount: number;
    scan?: WorkspaceScanFacts;
}
export interface WriteStateOptions {
    mode: StateEngineMode;
    writer: AdapterKind;
}
//# sourceMappingURL=types.d.ts.map