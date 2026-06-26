import type { NextActionItem } from './types.js';
/** Derive next actions — reads Event/Decision/State/Knowledge/Health, suggestions only. */
export declare function deriveNextActions(workspaceRoot: string): Promise<NextActionItem[]>;
export declare function getNextActions(workspaceRoot: string): Promise<string[]>;
//# sourceMappingURL=actionEngine.d.ts.map