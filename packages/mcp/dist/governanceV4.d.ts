/**
 * Contorium MCP Governance V4 — single-decision pipeline API.
 * @see 优化.md § V4 MCP 接口层
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readStateJson, type GovernanceReviewArtifact, type ReviewScopePreference, type ScopedFileReviewInput } from '@contora/state-core';
export declare function getControlContext(root: string): Promise<{
    version: string;
    workspaceRoot: string;
    project_state: {
        current_task: string;
        notes: string;
        session_id: string | undefined;
        open_files: string[];
        recent_files: string[];
        last_updated: number;
    };
    active_files: string[];
    git: {
        branch: string;
        staged: string[];
        working: string[];
        commit_head: string;
    };
    governance: {
        enabled: boolean;
        policy_version: string;
        constitution_loaded: boolean;
        truth_loaded: boolean;
        identity_loaded: boolean;
        protected_path_count: number;
        project_goal: string;
        summary: {
            found: boolean;
            workspaceRoot: string;
            constitution?: import("@contora/state-core").Constitution;
            truth?: import("@contora/state-core").TruthLayer;
            identity?: import("@contora/state-core").Identity;
            protected_path_count: number;
            mock_path_patterns: number;
        };
    };
    review_snapshot: {
        risk: import("@contora/state-core").GovernanceRisk;
        impact: import("@contora/state-core").GovernanceImpact;
        recommendation: string;
        review_source: import("@contora/state-core").ReviewSource;
        review_scope: import("@contora/state-core").ReviewScope;
        file: string;
    } | null;
    control_state: {
        workspaceRoot: string;
        bootstrap: Awaited<ReturnType<typeof readStateJson>>;
        cognitive: Awaited<ReturnType<typeof import("@contora/state-core").readCognitiveState>>;
        intent: Awaited<ReturnType<typeof import("@contora/state-core").readCognitiveIntent>>;
        governance_ready: boolean;
        recent_guard_checks: number;
    };
}>;
export declare function resolveScopeContext(root: string, input: {
    diff_text?: string;
    active_file?: string;
    mode?: 'auto' | 'strict' | 'minimal';
    scoped_files?: ScopedFileReviewInput[];
    scope_preference?: ReviewScopePreference;
}): Promise<{
    version: string;
    primary_files: string[];
    related_files: string[];
    risk_files: string[];
    dependency_files: string[];
    scope_preference: ReviewScopePreference;
    mode: "strict" | "auto" | "minimal";
}>;
export declare function runGovernanceCycle(root: string, input: {
    active_file?: string;
    diff?: {
        text?: string;
        lines_added?: number;
        lines_removed?: number;
    };
    scope?: {
        primary_files?: string[];
        related_files?: string[];
    };
    scope_mode?: 'auto' | 'strict' | 'minimal';
    scope_preference?: ReviewScopePreference;
    scoped_files?: ScopedFileReviewInput[];
    mode?: 'strict' | 'soft' | 'advisory';
    user_confirmed?: boolean;
    persist?: boolean;
    audit?: boolean;
}): Promise<{
    version: string;
    scope: {
        version: string;
        primary_files: string[];
        related_files: string[];
        risk_files: string[];
        dependency_files: string[];
        scope_preference: ReviewScopePreference;
        mode: "strict" | "auto" | "minimal";
    };
    review: {
        summary: string;
        issues: string[];
        artifact: GovernanceReviewArtifact | null;
        path: string;
    };
    diff_analysis: {
        change_type: import("@contora/state-core").ChangeType;
        severity: import("@contora/state-core").ChangeSeverity;
        impact: import("@contora/state-core").GovernanceImpact;
        confidence: number;
        lines_added: number;
        lines_removed: number;
    } | null;
    violations: {
        rule: string;
        severity: import("@contora/state-core").ChangeSeverity;
        file: string;
        line: string;
    }[];
    decision: {
        action: "allow" | "warn" | "block" | "inject_fix";
        reason: string;
        recommendation: string | undefined;
        allow: boolean;
        guard_action: "warn" | "block" | "pass" | undefined;
    };
    inject: {
        required: boolean;
        payload: string;
    };
    metrics: {
        risk: import("@contora/state-core").GovernanceRisk;
        display_score: number;
        confidence: number;
    };
    audit: unknown;
    next_action: string;
}>;
export declare function generateInjectPayload(root: string, input: {
    active_file?: string;
    user_task?: string;
    project_goal?: string;
    style?: 'minimal' | 'full' | 'explain';
    decision?: {
        artifact?: GovernanceReviewArtifact | null;
    };
    refresh_cycle?: boolean;
    cycle_mode?: 'strict' | 'soft' | 'advisory';
}): Promise<{
    version: string;
    inject_prompt: string;
    metadata: {
        why_chain: string[];
        risk_notes: (string | undefined)[];
        style: "minimal" | "full" | "explain";
        mode: "smart" | "diff";
    };
    review_summary: {
        risk: import("@contora/state-core").GovernanceRisk;
        recommendation: string;
        review_source: import("@contora/state-core").ReviewSource;
    } | null;
}>;
export declare function exportGovernanceContext(root: string, input: {
    active_file?: string;
    include?: Array<'governance' | 'diff' | 'inject' | 'state'>;
    refresh_cycle?: boolean;
}): Promise<{
    version: string;
    export_text: string;
    sections: Record<string, string>;
    review_path: string;
}>;
export declare function ensureControlReadyV4(root: string): Promise<{
    governance_initialized: boolean;
    synced: boolean;
    ready: boolean;
    version: string;
    policy_loaded: boolean;
    workspaceRoot: string;
}>;
export declare function registerGovernanceV4Tools(server: McpServer, resolveRoot: () => Promise<string>): void;
