import type { BootstrapStateJson, WorkspaceScanFacts } from '../types.js';
/** Collect candidate changed files from state + optional scan facts. */
export declare function collectChangedFiles(state: BootstrapStateJson, extraPaths?: string[], max?: number): string[];
/** Git diff names (staged + unstaged vs HEAD) — best-effort. */
export declare function gitDiffChangedFiles(workspaceRoot: string, max?: number): Promise<string[]>;
export declare function resolveChangedFiles(workspaceRoot: string, state: BootstrapStateJson, scan?: WorkspaceScanFacts, extraPaths?: string[]): Promise<string[]>;
//# sourceMappingURL=changeDetector.d.ts.map