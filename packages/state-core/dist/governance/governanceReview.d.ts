import type { ChangeSeverity, ChangeType } from './changeAnalyzer.js';
import type { ControlCheckResult } from '../control-core/types.js';
import type { GovernanceImpact, GovernanceRisk } from './riskEngine.js';
export type ReviewSource = 'editor_diff' | 'git_staged' | 'git_commit' | 'static_file';
export type ReviewScope = 'current_file' | 'open_files' | 'git_staged' | 'git_commit';
export interface BuildReviewOptions {
    reviewSource?: ReviewSource;
    reviewScope?: ReviewScope;
    stagedFiles?: string[];
}
export interface GovernanceReviewArtifact {
    version: 2;
    generatedAt: number;
    file: string;
    status: 'pass' | 'warn' | 'block';
    risk: GovernanceRisk;
    change_type: ChangeType;
    severity: ChangeSeverity;
    impact: GovernanceImpact;
    confidence: number;
    recommendation: string;
    reason: string;
    reason_chain: string[];
    allow: boolean;
    protectedPath: boolean;
    protectedLevel?: 'normal' | 'high' | 'critical';
    truthImpact: boolean;
    lines_added: number;
    lines_removed: number;
    /** Internal score for sorting/trends — not shown in UI. */
    display_score: number;
    review_source: ReviewSource;
    review_timestamp: string;
    review_scope: ReviewScope;
    staged_files?: string[];
    /** @deprecated Use display_score */
    score?: number;
}
export declare function buildGovernanceReviewArtifact(result: ControlCheckResult, filePath: string, opts?: BuildReviewOptions): GovernanceReviewArtifact;
export declare function writeGovernanceReview(workspaceRoot: string, artifact: GovernanceReviewArtifact): Promise<void>;
export declare function readGovernanceReview(workspaceRoot: string): Promise<GovernanceReviewArtifact | null>;
export declare function formatReviewForInject(review: GovernanceReviewArtifact): string;
export declare function formatGovernanceReviewYaml(review: GovernanceReviewArtifact): string;
export declare function buildGovernanceRulesLines(workspaceRoot: string, activeFile?: string): Promise<string[]>;
export declare function estimateTokens(text: string): number;
export declare function formatGovernanceExportSection(workspaceRoot: string, review: GovernanceReviewArtifact | null): Promise<string>;
/** @deprecated Use display_score on artifact — kept for callers expecting numeric helper. */
export declare function computeGovernanceScore(input: {
    risk: GovernanceRisk;
    protectedPath: boolean;
    truthImpact: boolean;
    allow: boolean;
}): number;
//# sourceMappingURL=governanceReview.d.ts.map