import type { ChangeArtifact, HandoffArtifact, ProjectTimeline } from '../understanding/types.js';
import { type GovernanceReviewArtifact } from './governanceReview.js';
/** Governance appendix = YAML section + unified DECISION/SCOPE/TRACE supplement. */
export declare function buildGovernanceExportAppendixFull(workspaceRoot: string, review: GovernanceReviewArtifact | null): Promise<string>;
export interface GovernanceAwareExportInput {
    workspaceRoot: string;
    handoff?: HandoffArtifact | null;
    change?: ChangeArtifact | null;
    currentTask?: string;
    lastWriter?: string;
    timeline?: ProjectTimeline | null;
    filter?: string;
    review?: GovernanceReviewArtifact | null;
}
/**
 * Unified export body — handoff/CHP + governance appendix.
 * Used by CLI [c], handoff --copy, contorium export, IDE, MCP export.
 */
export declare function buildGovernanceAwareExportText(input: GovernanceAwareExportInput): Promise<string | undefined>;
//# sourceMappingURL=governanceExportUnified.d.ts.map