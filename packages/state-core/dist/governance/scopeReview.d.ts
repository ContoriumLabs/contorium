import { type GovernanceReviewArtifact, type ReviewScope, type ReviewSource } from './governanceReview.js';
import type { GovernanceRisk } from './riskEngine.js';
export type ReviewScopePreference = 'auto' | 'current_file' | 'open_files' | 'git_staged' | 'git_commit';
declare const MAX_FILES_PER_SCOPE = 48;
declare const RISK_RANK: Record<GovernanceRisk, number>;
export interface ScopedFileReviewInput {
    relativePath: string;
    diff_text?: string;
    lines_added?: number;
    lines_removed?: number;
}
/** Review a list of files in a scope; returns highest-risk artifact. */
export declare function reviewScopedFiles(workspaceRoot: string, files: ScopedFileReviewInput[], opts: {
    reviewSource: ReviewSource;
    reviewScope: ReviewScope;
    scopeFiles?: string[];
    descriptionPrefix?: string;
}): Promise<GovernanceReviewArtifact | null>;
export declare function listGitStagedRelativePaths(workspaceRoot: string): Promise<string[]>;
export declare function getGitStagedDiff(workspaceRoot: string, relPath: string): Promise<string>;
export declare function reviewGitStagedChanges(workspaceRoot: string): Promise<GovernanceReviewArtifact | null>;
export declare function reviewOpenFilesChanges(workspaceRoot: string, files: ScopedFileReviewInput[]): Promise<GovernanceReviewArtifact | null>;
export declare function listGitCommitRelativePaths(workspaceRoot: string): Promise<string[]>;
export declare function getGitCommitFileDiff(workspaceRoot: string, relPath: string): Promise<string>;
export declare function reviewGitCommitChanges(workspaceRoot: string): Promise<GovernanceReviewArtifact | null>;
export declare function pickHigherRiskReview(a: GovernanceReviewArtifact, b: GovernanceReviewArtifact): GovernanceReviewArtifact;
export declare function mergeReviewArtifacts(artifacts: Array<GovernanceReviewArtifact | null | undefined>): GovernanceReviewArtifact | null;
export { RISK_RANK, MAX_FILES_PER_SCOPE };
//# sourceMappingURL=scopeReview.d.ts.map