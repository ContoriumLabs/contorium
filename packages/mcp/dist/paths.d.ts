/** Workspace root for MCP (Claude Code / Cursor spawn cwd or explicit env). */
export declare function resolveWorkspaceRoot(): string;
export declare function contoraDir(workspaceRoot: string): string;
export declare function mcpMemoryFile(workspaceRoot: string): string;
export declare function stateSummaryFile(workspaceRoot: string): string;
export declare function intentGraphFile(workspaceRoot: string): string;
export declare function projectStateFile(workspaceRoot: string): string;
export declare function projectSnapshotFile(workspaceRoot: string): string;
export declare function conflictsFile(workspaceRoot: string): string;
export declare function findWorkspaceRoot(startDir: string): Promise<string>;
