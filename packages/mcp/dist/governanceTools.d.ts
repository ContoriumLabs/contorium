import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
/** Auxiliary control tools — not part of V4 governance cycle (see governanceV4.ts). */
export declare function registerGovernanceAuxTools(server: McpServer, resolveRoot: () => Promise<string>): void;
/** @deprecated Use registerGovernanceAuxTools + registerGovernanceV4Tools */
export declare function registerGovernanceTools(server: McpServer, resolveRoot: () => Promise<string>): void;
