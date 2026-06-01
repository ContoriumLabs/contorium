import type { BootstrapStateJson, DualModeInput, StateEngineMode, WorkspaceScanFacts } from './types.js';
/** Resolve engine mode from available inputs. */
export declare function resolveStateEngineMode(eventCount: number, hasExistingState: boolean): StateEngineMode;
/** Merge scan facts into state without overwriting user task/notes. */
export declare function mergeStateWithScan(state: BootstrapStateJson, scan: WorkspaceScanFacts): BootstrapStateJson;
export declare function buildDualModeInput(args: {
    state: BootstrapStateJson;
    eventCount: number;
    scan: WorkspaceScanFacts;
}): DualModeInput;
//# sourceMappingURL=dualMode.d.ts.map