import type { Constitution, ForbiddenPatternRule, GovernanceAction, GovernanceBundle, Identity, ProtectedPathLevel, ProtectedPathRule, TruthLayer, ValidationResult } from './types.js';
export declare function normalizeProtectedPathRules(entries: Constitution['protected_paths']): ProtectedPathRule[];
export declare function defaultForbiddenPatterns(): ForbiddenPatternRule[];
export declare function matchProtectedPath(filePath: string | undefined, constitution: Constitution): {
    path: string;
    level: ProtectedPathLevel;
} | undefined;
export declare function scanForbiddenPatterns(probe: string, constitution: Constitution): ForbiddenPatternRule | undefined;
export declare function loadGovernanceBundle(workspaceRoot: string): Promise<GovernanceBundle | null>;
export declare function validateActionWithBundle(bundle: GovernanceBundle, action: GovernanceAction & {
    code_snippet?: string;
    diff_text?: string;
}): ValidationResult;
export declare function validateAction(workspaceRoot: string, action: GovernanceAction): Promise<ValidationResult>;
export declare function validatePathChange(bundle: GovernanceBundle, filePath: string, changeType?: 'write' | 'delete'): ValidationResult;
export declare function getGovernanceSummary(workspaceRoot: string): Promise<{
    found: boolean;
    workspaceRoot: string;
    constitution?: Constitution;
    truth?: TruthLayer;
    identity?: Identity;
    protected_path_count: number;
    mock_path_patterns: number;
}>;
//# sourceMappingURL=governanceEngine.d.ts.map