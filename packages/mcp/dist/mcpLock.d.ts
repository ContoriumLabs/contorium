/** One MCP stdio server per workspace — second instance skips light sync side effects. */
export declare function tryClaimMcpWorkspaceLock(workspaceRoot: string): boolean;
export declare function releaseMcpWorkspaceLock(workspaceRoot: string): void;
