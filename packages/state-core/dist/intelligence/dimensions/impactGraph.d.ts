import type { ImpactGraphArtifact, ImpactGraphEntry } from '../types.js';
export declare function readImpactGraph(workspaceRoot: string): Promise<ImpactGraphArtifact | null>;
export declare function queryImpactGraph(graph: ImpactGraphArtifact, entityId?: string): ImpactGraphEntry[];
/** BFS propagation over module adjacency derived from affected paths. */
export declare function deriveImpactPropagation(args: {
    source_entity: string;
    change_type: string;
    seed_modules: string[];
    related_modules: string[];
    risk_hint?: 'low' | 'medium' | 'high' | 'critical';
}): ImpactGraphEntry;
export declare function upsertImpactGraphEntry(workspaceRoot: string, entry: ImpactGraphEntry): Promise<ImpactGraphArtifact>;
//# sourceMappingURL=impactGraph.d.ts.map