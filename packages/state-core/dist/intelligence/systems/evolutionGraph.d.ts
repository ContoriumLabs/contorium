import type { EvolutionGraphArtifact, EvolutionGraphChain } from '../types.js';
export declare function readEvolutionGraph(workspaceRoot: string): Promise<EvolutionGraphArtifact | null>;
export declare function queryEvolutionGraph(artifact: EvolutionGraphArtifact, topic?: string): EvolutionGraphChain[];
/**
 * Structured transformation chains (not chronological timeline).
 * Example: Auth V1 → JWT → Multi Tenant → SSO
 */
export declare function deriveEvolutionGraph(workspaceRoot: string): Promise<EvolutionGraphArtifact>;
//# sourceMappingURL=evolutionGraph.d.ts.map