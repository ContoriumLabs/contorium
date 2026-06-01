import type { AdapterKind, BootstrapStateJson, WorkspaceScanFacts } from '../types.js';
/** Unified scan path — MCP / CLI / IDE fallback share one state-builder implementation. */
export declare function rebuildArtifactsFromScan(workspaceRoot: string, scan: WorkspaceScanFacts, state?: BootstrapStateJson, writer?: AdapterKind): Promise<void>;
//# sourceMappingURL=rebuildFromScan.d.ts.map