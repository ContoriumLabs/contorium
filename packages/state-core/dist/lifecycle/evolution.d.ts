import type { AdrRecord } from '../cil/types.js';
/** Walk superseded_by chain into an evolution timeline (oldest -> newest). */
export declare function buildDecisionEvolutionChain(adrs: AdrRecord[], startId: string): string[];
/** Build superseded context for validity layer (优化.md §三.5). */
export declare function buildSupersededContext(adr: AdrRecord, adrs: AdrRecord[]): import('./types.js').SupersededContext | undefined;
export declare function mapAdrToLifecycleStatus(status: AdrRecord['status']): import('./types.js').LifecycleDecisionStatus;
//# sourceMappingURL=evolution.d.ts.map