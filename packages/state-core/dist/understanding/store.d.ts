import type { AnyHandoffArtifact, ChangeArtifact, HandoffArtifact, ImpactArtifact, IntentArtifact, ProjectGraph, ProjectTimeline } from './types.js';
import type { UnderstandingGraph } from './understandingGraphBuilder.js';
/** Normalize V3.0 handoff → V3.1 shape on read. */
export declare function normalizeHandoff(raw: AnyHandoffArtifact | undefined): HandoffArtifact | undefined;
/** Normalize V3.0 change.json on read. */
export declare function normalizeChange(raw: unknown): ChangeArtifact | undefined;
export declare function readProjectGraph(workspaceRoot: string): Promise<ProjectGraph | undefined>;
export declare function readChangeArtifact(workspaceRoot: string): Promise<ChangeArtifact | undefined>;
export declare function readHandoffArtifact(workspaceRoot: string): Promise<HandoffArtifact | undefined>;
export declare function readProjectTimeline(workspaceRoot: string): Promise<ProjectTimeline | undefined>;
/** @deprecated V3.1 — impact merged into handoff.json */
export declare function readImpactArtifact(workspaceRoot: string): Promise<ImpactArtifact | undefined>;
/** @deprecated V3.1 — intent merged into handoff.json */
export declare function readIntentArtifact(workspaceRoot: string): Promise<IntentArtifact | undefined>;
export declare function readUnderstandingGraph(workspaceRoot: string): Promise<UnderstandingGraph | undefined>;
export declare function writeUnderstandingArtifacts(workspaceRoot: string, artifacts: {
    graph: ProjectGraph;
    change: ChangeArtifact;
    handoff: HandoffArtifact;
    timeline: ProjectTimeline;
    understandingGraph?: UnderstandingGraph;
}): Promise<void>;
export declare function deleteUnderstandingArtifacts(workspaceRoot: string): Promise<void>;
//# sourceMappingURL=store.d.ts.map