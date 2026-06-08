/** Spawn minimized Contorium Dashboard — one window, no npm/npx. */
export declare function spawnDashboardWindow(workspaceRoot: string): boolean;
/** Fallback attach when CLI dist import unavailable (published npm / npx MCP). */
export declare function attachDashboardFallback(workspaceRoot: string): Promise<void>;
