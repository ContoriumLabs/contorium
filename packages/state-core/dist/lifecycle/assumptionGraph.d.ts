import type { AdrRecord } from '../cil/types.js';
export declare const ASSUMPTION_GRAPH_SCHEMA: "contorium.assumption_graph.v1";
export type AssumptionCategory = 'technology' | 'architecture' | 'business' | 'performance' | 'security' | 'ownership' | 'cost';
export interface AssumptionNode {
    id: string;
    decision_id: string;
    assumption: string;
    type: AssumptionCategory;
    verification_sources: string[];
}
export interface AssumptionGraphArtifact {
    schema: typeof ASSUMPTION_GRAPH_SCHEMA;
    updated_at: string;
    assumptions: AssumptionNode[];
}
export declare function buildAssumptionGraph(adrs: AdrRecord[]): AssumptionGraphArtifact;
export declare function persistAssumptionGraph(workspaceRoot: string, adrs: AdrRecord[]): Promise<AssumptionGraphArtifact>;
export declare function readAssumptionGraph(workspaceRoot: string): Promise<AssumptionGraphArtifact | null>;
//# sourceMappingURL=assumptionGraph.d.ts.map