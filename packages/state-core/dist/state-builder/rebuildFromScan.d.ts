import type { AdapterKind, BootstrapStateJson, WorkspaceScanFacts } from '../types.js';
export interface RebuildFromScanOptions {
    /** Skip `git log` when building timeline (MCP/Codex startup). */
    skipGitTimeline?: boolean;
}
/** Unified scan path — MCP / CLI / IDE fallback share one state-builder implementation. */
export declare function rebuildArtifactsFromScan(workspaceRoot: string, scan: WorkspaceScanFacts, state?: BootstrapStateJson, writer?: AdapterKind, opts?: RebuildFromScanOptions): Promise<void>;
//# sourceMappingURL=rebuildFromScan.d.ts.map