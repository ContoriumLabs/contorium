/** Apply CLI --workspace before other resolution (call once at startup). */
export declare function initWorkspaceFromArgv(argv?: string[]): string;
/** Workspace root for MCP (priority: startup override → env → .mcp.json → cwd). */
export declare function resolveWorkspaceRoot(): string;
export declare function contoraDir(workspaceRoot: string): string;
export declare function mcpMemoryFile(workspaceRoot: string): string;
export declare function stateSummaryFile(workspaceRoot: string): string;
export declare function intentGraphFile(workspaceRoot: string): string;
export declare function projectStateFile(workspaceRoot: string): string;
export declare function projectSnapshotFile(workspaceRoot: string): string;
export declare function conflictsFile(workspaceRoot: string): string;
export declare function findWorkspaceRoot(startDir: string): Promise<string>;
