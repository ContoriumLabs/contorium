import type { AdrRecord, DecisionGraphArtifact } from './types.js';
export declare function buildDecisionGraphFromAdrs(adrs: AdrRecord[]): DecisionGraphArtifact;
export declare function persistDecisionGraph(workspaceRoot: string, adrs: AdrRecord[]): Promise<DecisionGraphArtifact>;
export declare function readDecisionGraph(workspaceRoot: string): Promise<DecisionGraphArtifact | null>;
//# sourceMappingURL=decisionGraph.d.ts.map