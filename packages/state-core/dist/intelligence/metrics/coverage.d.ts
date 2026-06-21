/**
 * Knowledge coverage — covered_modules / total_modules.
 * A module is covered when it has STATE presence and at least one of INTENT | DECISION | WHY.
 */
export declare function deriveKnowledgeCoverage(workspaceRoot: string): Promise<{
    knowledge_coverage: number;
    covered_modules: string[];
    total_modules: string[];
}>;
//# sourceMappingURL=coverage.d.ts.map