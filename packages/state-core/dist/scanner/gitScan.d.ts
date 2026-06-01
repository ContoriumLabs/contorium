/** Git scan without simple-git — for MCP/CLI standalone. */
export declare function scanGitPorcelain(workspaceRoot: string): Promise<{
    staged: string[];
    working: string[];
    isRepo: boolean;
}>;
//# sourceMappingURL=gitScan.d.ts.map