import type { BootstrapStateJson, WriteStateOptions, WorkspaceScanFacts } from '../types.js';
export declare function bootstrapStateFromScan(scan: WorkspaceScanFacts): BootstrapStateJson;
export declare function readStateJson(workspaceRoot: string): Promise<BootstrapStateJson | null>;
export declare function writeStateJson(workspaceRoot: string, state: BootstrapStateJson, meta?: WriteStateOptions): Promise<void>;
export declare function stateJsonExists(workspaceRoot: string): Promise<boolean>;
//# sourceMappingURL=bootstrapState.d.ts.map