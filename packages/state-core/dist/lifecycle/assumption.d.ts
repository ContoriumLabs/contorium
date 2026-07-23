import type { AdrRecord } from '../cil/types.js';
import type { AdrAssumption, ValiditySignal } from './types.js';
/** Extract assumptive statements from ADR reason text. */
export declare function extractAdrAssumptions(adr: AdrRecord): AdrAssumption[];
/** Heuristic assumption failure from handoff, events, focus, and manifests. */
export declare function detectAssumptionFailures(workspaceRoot: string, adr: AdrRecord, assumptions?: AdrAssumption[]): Promise<ValiditySignal[]>;
//# sourceMappingURL=assumption.d.ts.map