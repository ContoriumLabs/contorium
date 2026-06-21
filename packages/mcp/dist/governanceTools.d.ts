import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/** Auxiliary inspection tools — Decision Provenance Layer (not execution). */
export declare function registerGovernanceAuxTools(server: McpServer, resolveRoot: () => Promise<string>): void;
/** @deprecated Use registerGovernanceAuxTools + registerGovernanceV4Tools */
export declare function registerGovernanceTools(server: McpServer, resolveRoot: () => Promise<string>): void;
