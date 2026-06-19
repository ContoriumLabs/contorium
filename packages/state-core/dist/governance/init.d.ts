export interface EnsureGovernanceResult {
    initialized: boolean;
    created: boolean;
}
/**
 * Seed `.contora/governance/` on first workspace bootstrap.
 * Never overwrites existing user-edited files.
 */
export declare function ensureGovernanceLayer(workspaceRoot: string): Promise<EnsureGovernanceResult>;
/** Refresh identity.current_focus from handoff without overwriting user fields. */
export declare function syncIdentityFocus(workspaceRoot: string, focus: string[]): Promise<void>;
//# sourceMappingURL=init.d.ts.map