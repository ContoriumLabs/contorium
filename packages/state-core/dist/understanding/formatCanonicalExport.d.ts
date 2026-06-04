import type { HandoffArtifact, HandoffNextAction, ProjectTimeline } from './types.js';
import type { ProjectBuiltState } from '../state-builder/types.js';
import type { KnowledgeSnapshot } from './knowledgeGraph/types.js';
/** Machine-stable graph ref: fn:name, cls:name, mod:path */
export declare function normalizeGraphRef(ref: string): string;
/** Plain next line for canonical export (no [action] tags). */
export declare function formatNextActionPlain(a: HandoffNextAction): string;
/** V3.1 execution block — single AI decision entry (no duplicate snapshot lists). */
export declare function formatAiHandoffExecutionBlock(handoff: HandoffArtifact): string;
export interface CanonicalAiExportInput {
    taskAnchor: string;
    built?: ProjectBuiltState | null;
    snapshotMarkdown?: string;
    activeFiles: string[];
    recentGitActivity: string[];
    handoff?: HandoffArtifact | null;
    timeline?: ProjectTimeline;
    instruction: string;
    notes?: string;
    /** Optional weak insights — omitted from canonical body when empty */
    insights?: string[];
    /** V3.1 cognitive snapshot — preferred over full graph refs */
    knowledgeSnapshot?: KnowledgeSnapshot | null;
}
/**
 * V3.1 canonical markdown for IDE one-click copy (AI Mode).
 * Layered: snapshot → working context → change/impact/graph → execution handoff → instruction.
 */
export declare function formatCanonicalAiMarkdown(input: CanonicalAiExportInput): string;
//# sourceMappingURL=formatCanonicalExport.d.ts.map