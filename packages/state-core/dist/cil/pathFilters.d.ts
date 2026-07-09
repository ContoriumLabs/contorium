import type { CognitiveEvent } from './types.js';
/** Paths under Contorium's local store — hidden from user-facing Ask/history output. */
export declare function isContoraInternalPath(relPath: string): boolean;
export declare function filterUserFacingPaths(paths: string[]): string[];
/** Drop internal artifact paths from free-text impact/history lines. */
export declare function filterUserFacingLines(lines: string[]): string[];
/** Sanitize event file/impact lists for Ask, CLI, and IDE display. */
export declare function sanitizeCognitiveEventForDisplay(event: CognitiveEvent): CognitiveEvent;
//# sourceMappingURL=pathFilters.d.ts.map