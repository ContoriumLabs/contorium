/**
 * MCP initialize → in-process bootstrap when possible; hidden node spawn fallback.
 * Never npx/npm exec (Codex shows "npm exec contorium bootstrap" flash window).
 */
export declare function ensureMcpDashboardAttached(workspaceRoot: string): Promise<void>;
