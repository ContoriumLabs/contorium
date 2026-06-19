import type { GovernanceReviewArtifact } from './governanceReview.js';
export declare const GOVERNANCE_SCHEMA: "governance.v1";
export type GovernanceArtifactSource = 'ide' | 'cli' | 'mcp';
export type GovernanceDecisionAction = 'allow' | 'warn' | 'block' | 'inject_fix';
export type GovernanceCycleMode = 'strict' | 'soft' | 'advisory';
/** Unified header on every governance artifact. */
export interface GovernanceArtifactHeader {
    schema: typeof GOVERNANCE_SCHEMA;
    source: GovernanceArtifactSource;
    created_at: string;
}
export interface GovernanceScopeMap {
    primary_files: string[];
    related_files: string[];
    risk_files: string[];
    dependency_files: string[];
}
/** Result only — no scope duplication; rule details live on cycle.matched_rules. */
export interface GovernanceDecisionArtifact extends GovernanceArtifactHeader {
    allow: boolean;
    /** Normalized 0–1 risk (from display_score / 100). */
    risk: number;
    decision: GovernanceDecisionAction;
    mode_label: string;
    rule_count: number;
    recommendation: string;
}
export interface GovernanceScopeFiles {
    primary: string[];
    related: string[];
    risk: string[];
}
/** Context only — no decision fields. */
export interface GovernanceScopeArtifact extends GovernanceArtifactHeader {
    files: GovernanceScopeFiles;
    modules: string[];
    dependencies: string[];
}
/** Dashboard / export read this (bounded). */
export interface GovernanceTraceSummaryArtifact extends GovernanceArtifactHeader {
    steps: string[];
    step_count: number;
}
/** Optional detailed trace — capped; overwritten each cycle. */
export interface GovernanceTraceFullArtifact extends GovernanceArtifactHeader {
    steps: string[];
    reason_chain: string[];
    events: string[];
}
/** Governance cycle runtime record — refs + extension slots for V5. */
export interface GovernanceCycleArtifact extends GovernanceArtifactHeader {
    started_at: string;
    finished_at: string;
    decision: GovernanceDecisionAction;
    metrics: {
        risk_score?: number;
        confidence?: number;
        files_affected?: number;
    };
    votes: unknown[];
    matched_rules: string[];
    trace_ref: string;
    review_path: string;
    scope_ref: string;
    decision_ref: string;
    v4?: unknown;
}
export interface GovernanceArtifactBundle {
    review: GovernanceReviewArtifact | null;
    decision: GovernanceDecisionArtifact | null;
    scope: GovernanceScopeArtifact | null;
    trace: GovernanceTraceSummaryArtifact | null;
    cycle: GovernanceCycleArtifact | null;
}
export interface GovernanceDashboardSnapshot {
    review: GovernanceReviewArtifact | null;
    scope: GovernanceScopeMap;
    scope_full: GovernanceScopeMap;
    decision_action: GovernanceDecisionAction | '—';
    risk_score: number;
    mode_label: string;
    rule_count: number;
    files_affected: number;
}
/** Validate artifact header schema — no separate schema.json manifest. */
export declare function validateArtifactSchema(artifact: unknown, expected?: typeof GOVERNANCE_SCHEMA): artifact is GovernanceArtifactHeader;
export declare function governanceModeLabel(review: GovernanceReviewArtifact | null): string;
export declare function mapGovernanceDecisionAction(review: GovernanceReviewArtifact | null, mode?: GovernanceCycleMode): GovernanceDecisionAction;
export declare function buildGovernanceScopeFromReview(review: GovernanceReviewArtifact | null, extra?: Partial<GovernanceScopeMap>, openFiles?: string[]): GovernanceScopeMap;
export declare function scopeMapToArtifact(source: GovernanceArtifactSource, map: GovernanceScopeMap, at?: number): GovernanceScopeArtifact;
export declare function scopeArtifactToMap(scope: GovernanceScopeArtifact | null): GovernanceScopeMap;
export declare function buildGovernanceTraceSteps(input: {
    review: GovernanceReviewArtifact | null;
    action: GovernanceDecisionAction;
    files_affected: number;
    rule_count: number;
    risk_score: number;
}): string[];
/**
 * Full governance cycle — writes decision, scope, trace, cycle (+ optional trace-full).
 * Review-only flows must NOT call this; use writeGovernanceReview only.
 */
export declare function persistGovernanceCycleArtifacts(workspaceRoot: string, input: {
    source: GovernanceArtifactSource;
    review: GovernanceReviewArtifact | null;
    scope?: GovernanceScopeMap;
    decision_action?: GovernanceDecisionAction;
    cycle_mode?: GovernanceCycleMode;
    open_files?: string[];
    started_at?: number;
    v4_payload?: unknown;
}): Promise<GovernanceCycleArtifact | null>;
/** @deprecated Use persistGovernanceCycleArtifacts — review-only must not call this. */
export declare function persistGovernanceArtifacts(workspaceRoot: string, input: Parameters<typeof persistGovernanceCycleArtifacts>[1]): Promise<GovernanceCycleArtifact | null>;
export declare function readGovernanceDecision(workspaceRoot: string): Promise<GovernanceDecisionArtifact | null>;
export declare function readGovernanceScopeArtifact(workspaceRoot: string): Promise<GovernanceScopeArtifact | null>;
export declare function readGovernanceTraceSummary(workspaceRoot: string): Promise<GovernanceTraceSummaryArtifact | null>;
/** @deprecated Alias for readGovernanceTraceSummary */
export declare function readGovernanceTrace(workspaceRoot: string): Promise<GovernanceTraceSummaryArtifact | null>;
export declare function readGovernanceCycle(workspaceRoot: string): Promise<GovernanceCycleArtifact | null>;
/** Single entry for all consumers (Dashboard, Export, IDE). */
export declare function loadGovernanceArtifactBundle(workspaceRoot: string): Promise<GovernanceArtifactBundle>;
/** Dashboard snapshot — only via state-core bundle (no direct artifact dir reads in CLI). */
export declare function loadGovernanceDashboardSnapshot(workspaceRoot: string): Promise<GovernanceDashboardSnapshot>;
/** Markdown supplement — DECISION / SCOPE / TRACE (三端共用). */
export declare function buildGovernanceSupplement(bundle: GovernanceArtifactBundle): string;
export declare const GOVERNANCE_ARTIFACT_FILES: readonly ["governance/review.json", "governance/decision.json", "governance/scope.json", "governance/trace.json", "governance/trace-full.json", "governance/cycle.json", "mcp/governance-cycle.json"];
//# sourceMappingURL=governanceArtifacts.d.ts.map