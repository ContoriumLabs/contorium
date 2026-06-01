import type { ProjectBuiltState } from './types.js';
/** L3 — dedupe, layer split, loop guard, semantic compression. */
export declare function normalizeProjectBuiltState(raw: ProjectBuiltState, taskAnchor: string): ProjectBuiltState;
export declare function filterWeakInferenceLines(lines: readonly string[], taskAnchor: string): string[];
//# sourceMappingURL=normalization.d.ts.map