export interface McpStartupConfig {
    workspaceHint: string;
    workspaceFromArgv: boolean;
}
/** Set once at process start from CLI --workspace (highest priority). */
export declare function setStartupWorkspace(workspace: string | undefined): void;
/**
 * Workspace hint resolution (MCP v1 standard):
 * 1. CLI --workspace
 * 2. CONTORIUM_WORKSPACE (+ host env aliases)
 * 3. .mcp.json / .cursor/mcp.json
 * 4. process.cwd()
 */
export declare function resolveMcpStartupConfig(argv?: string[]): McpStartupConfig;
