import type { ChangeArtifact, HandoffArtifact, ImpactAnalysis, IntentFusion, ProjectGraph } from './types.js';
import type { ProjectBuiltState } from '../state-builder/types.js';
export declare function buildHandoff(args: {
    goal: string;
    intent: IntentFusion;
    change: ChangeArtifact;
    impact: ImpactAnalysis;
    graph: ProjectGraph;
    built?: ProjectBuiltState | null;
    now?: number;
}): HandoffArtifact;
//# sourceMappingURL=handoffBuilder.d.ts.map