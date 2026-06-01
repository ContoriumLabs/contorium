import type { AdapterKind, BootstrapStateJson, StateEngineMode, StateSourceMetadata } from './types.js';
export declare function attachStateSource(state: BootstrapStateJson, mode: StateEngineMode, writer: AdapterKind): BootstrapStateJson;
export declare function parseStateSource(raw: unknown): StateSourceMetadata | undefined;
//# sourceMappingURL=sourceMetadata.d.ts.map