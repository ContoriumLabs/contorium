import type { ProjectGraph } from './types.js';
import type { ChangeArtifact } from './types.js';
import { type FileExtraction } from './extractor.js';
export declare function buildChangeNeighborhoodGraph(workspaceRoot: string, changedFiles: string[], now?: number): Promise<{
    graph: ProjectGraph;
    extractions: Map<string, FileExtraction>;
}>;
export declare function deriveChangeArtifact(changedFiles: string[], extractions: Map<string, FileExtraction>, now?: number): ChangeArtifact;
//# sourceMappingURL=graphBuilder.d.ts.map