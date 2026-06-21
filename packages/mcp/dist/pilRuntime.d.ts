import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/**
 * Contorium v3.0 — PIL Runtime Contract for MCP.
 * Three capability groups: Capture · Inspect · Transfer
 * Legacy get_project_* / get_cognitive_snapshot tools remain as aliases.
 */
export declare function registerPilRuntimeTools(server: McpServer, resolveRoot: () => Promise<string>): void;
