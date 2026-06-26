import type { AdapterKind } from '../types.js';
import type { AdrRecord, CognitiveEvent } from './types.js';
/** Build unified cognitive events from existing PIL artifacts. */
export declare function syncCognitiveEvents(workspaceRoot: string, writer?: AdapterKind): Promise<CognitiveEvent[]>;
/** Generate ADR records from decision provenance nodes. */
export declare function syncDecisionCenter(workspaceRoot: string): Promise<AdrRecord[]>;
//# sourceMappingURL=eventEngine.d.ts.map