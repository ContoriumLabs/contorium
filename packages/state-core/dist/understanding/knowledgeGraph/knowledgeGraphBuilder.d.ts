import type { ProjectBuiltState } from '../../state-builder/types.js';
import type { ChangeArtifact, IntentFusion, ProjectGraph } from '../types.js';
import type { ProjectKnowledgeGraph } from './types.js';
export interface KnowledgeGraphBuildInput {
    graph: ProjectGraph;
    change: ChangeArtifact;
    intent: IntentFusion;
    built?: ProjectBuiltState | null;
    goal: string;
    workspaceRoot?: string;
    sourceVersion?: string;
    now?: number;
    editCounts?: Map<string, number>;
    gitFrequency?: Map<string, number>;
    rebuildTrigger?: string;
    lastCommitHash?: string;
}
/**
 * Build Project Knowledge Graph from L1/L2 sources only.
 * L3 (intelligence / intent-graph / AI speculation) must never feed this builder.
 */
export declare function buildProjectKnowledgeGraph(input: KnowledgeGraphBuildInput): ProjectKnowledgeGraph;
//# sourceMappingURL=knowledgeGraphBuilder.d.ts.map