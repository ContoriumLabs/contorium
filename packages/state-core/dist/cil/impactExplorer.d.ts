import type { BlastRadiusResult } from './types.js';
export declare function getBlastRadius(workspaceRoot: string, node: string): Promise<BlastRadiusResult>;
export declare function exploreImpact(workspaceRoot: string, node?: string): Promise<{
    formatted: string[];
    result?: BlastRadiusResult;
}>;
//# sourceMappingURL=impactExplorer.d.ts.map