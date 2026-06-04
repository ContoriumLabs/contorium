import type { ChangeArtifact, ProjectGraph, ProjectTimeline } from './types.js';
export declare function buildProjectTimeline(workspaceRoot: string, changedFiles: string[], change: ChangeArtifact, graph: ProjectGraph, now?: number, maxCommits?: number): Promise<ProjectTimeline>;
//# sourceMappingURL=timelineTracker.d.ts.map