import type { AdrRecord } from '../cil/types.js';
import type { ValiditySignal } from './types.js';
/** Detect dependency drift vs ADR technology choices. */
export declare function scanDependencyValiditySignals(workspaceRoot: string, adr: AdrRecord): Promise<ValiditySignal[]>;
//# sourceMappingURL=dependencyScanner.d.ts.map