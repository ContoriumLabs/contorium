import type { AdrRecord, CognitiveEvent } from '../cil/types.js';
import type { AssumptionGraphArtifact } from './assumptionGraph.js';
export declare const DECISION_DEPENDENCY_GRAPH_SCHEMA: "contorium.decision_dependency_graph.v1";
export interface DecisionDependencyNode {
    decision: string;
    depends_on: {
        assumptions: string[];
        modules: string[];
        dependencies: string[];
        owners: string[];
    };
}
export interface DecisionDependencyGraphArtifact {
    schema: typeof DECISION_DEPENDENCY_GRAPH_SCHEMA;
    updated_at: string;
    decisions: DecisionDependencyNode[];
}
export declare function buildDecisionDependencyGraph(adrs: AdrRecord[], events: CognitiveEvent[], assumptionGraph?: AssumptionGraphArtifact): DecisionDependencyGraphArtifact;
export declare function persistDecisionDependencyGraph(workspaceRoot: string, adrs: AdrRecord[]): Promise<DecisionDependencyGraphArtifact>;
export declare function readDecisionDependencyGraph(workspaceRoot: string): Promise<DecisionDependencyGraphArtifact | null>;
//# sourceMappingURL=decisionDependencyGraph.d.ts.map