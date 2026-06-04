import type { BootstrapStateJson, WorkspaceScanFacts } from '../types.js';
import type { ProjectBuiltState } from '../state-builder/types.js';
import type { ProjectKnowledgeGraph } from './knowledgeGraph/types.js';
import type { ChangeArtifact, HandoffArtifact, ProjectGraph, ProjectTimeline } from './types.js';
export interface UnderstandingBuildInput {
    workspaceRoot: string;
    state?: BootstrapStateJson;
    built?: ProjectBuiltState | null;
    scan?: WorkspaceScanFacts;
    extraChangedPaths?: string[];
}
export interface UnderstandingBuildResult {
    graph: ProjectGraph;
    change: ChangeArtifact;
    handoff: HandoffArtifact;
    timeline: ProjectTimeline;
    knowledge: ProjectKnowledgeGraph;
}
export declare function buildUnderstandingArtifacts(input: UnderstandingBuildInput): Promise<UnderstandingBuildResult | undefined>;
/** Build and persist V3.1 understanding artifacts (graph + change + handoff + timeline). */
export declare function buildAndWriteUnderstandingArtifacts(input: UnderstandingBuildInput): Promise<UnderstandingBuildResult | undefined>;
//# sourceMappingURL=buildUnderstanding.d.ts.map