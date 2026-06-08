import type { ChangeArtifact, ProjectGraph, ProjectTimeline } from './types.js';
export interface BuildProjectTimelineOptions {
    skipGitLog?: boolean;
}
export declare function buildProjectTimeline(workspaceRoot: string, changedFiles: string[], change: ChangeArtifact, graph: ProjectGraph, now?: number, maxCommits?: number, opts?: BuildProjectTimelineOptions): Promise<ProjectTimeline>;
//# sourceMappingURL=timelineTracker.d.ts.map