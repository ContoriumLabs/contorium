import type { AdapterKind } from './types.js';
/** Tool adapter contract — adapters ingest; State Engine owns truth. */
export interface ContoriumAdapter {
    readonly kind: AdapterKind;
    /** Human-readable status for logs / MCP debug. */
    describe(): string;
}
export declare class IdeAdapter implements ContoriumAdapter {
    readonly kind: "ide";
    describe(): string;
}
export declare class McpAdapter implements ContoriumAdapter {
    readonly kind: "mcp";
    describe(): string;
}
export declare class CliAdapter implements ContoriumAdapter {
    readonly kind: "cli";
    describe(): string;
}
//# sourceMappingURL=adapters.d.ts.map