import type { HandoffArtifact, HandoffNextAction, ProjectTimeline } from './types.js';
import type { KnowledgeSnapshot } from './knowledgeGraph/types.js';
/** Single Next bullet — drops redundant "target: reason" when they repeat or overlap. */
export declare function formatNextActionBullet(a: HandoffNextAction): string;
/** CLI handoff markdown — execution block + optional timeline. */
export declare function formatHandoffMarkdown(handoff: HandoffArtifact, timeline?: ProjectTimeline): string;
/** Compact JSON export bundle for CLI `contorium export --format json`. */
export declare function buildUnderstandingExportJson(args: {
    handoff: HandoffArtifact;
    timeline?: ProjectTimeline;
    projectSnapshot?: string;
    knowledgeSnapshot?: KnowledgeSnapshot;
}): {
    version: string;
    projectSnapshot: string | undefined;
    cognitiveSnapshot: KnowledgeSnapshot | undefined;
    handoff: HandoffArtifact;
    timeline: import("./types.js").TimelineEntry[] | undefined;
};
//# sourceMappingURL=formatHandoff.d.ts.map