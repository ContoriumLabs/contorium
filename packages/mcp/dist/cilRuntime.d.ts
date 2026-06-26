import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/**
 * Contorium CIL v3 — Cognitive Interaction Layer MCP tools.
 * All paths route through Cognitive Kernel where applicable.
 */
export declare function registerCilRuntimeTools(server: McpServer, resolveRoot: () => Promise<string>): void;
