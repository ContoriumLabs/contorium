import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/**
 * CIL AI Layer — read-only status tools (explanation layer; facts stay rule-based).
 */
export declare function registerAiRuntimeTools(server: McpServer, resolveRoot: () => Promise<string>): void;
