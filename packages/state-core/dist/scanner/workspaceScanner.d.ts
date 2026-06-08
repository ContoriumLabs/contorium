import type { WorkspaceScanFacts } from '../types.js';
export interface ScanWorkspaceOptions {
    /** Use cached git fields — no git.exe subprocess (MCP/Codex startup). */
    skipGitScan?: boolean;
    cachedGit?: {
        staged: string[];
        working: string[];
        isRepo: boolean;
    };
}
/** Mode B — workspace filesystem scan (no IDE required). */
export declare function scanWorkspace(workspaceRoot: string, opts?: ScanWorkspaceOptions): Promise<WorkspaceScanFacts>;
//# sourceMappingURL=workspaceScanner.d.ts.map