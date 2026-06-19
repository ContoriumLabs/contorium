export type GovernanceInjectMode = 'smart' | 'diff';
export interface GovernanceInjectInput {
    workspaceRoot: string;
    projectGoal?: string;
    userTask?: string;
    activeFile?: string;
}
export interface RelevantGovernanceForFile {
    active: boolean;
    activeFile?: string;
    isProtected: boolean;
    matchedProtectedPath?: string;
    matchedProtectedLevel?: string;
    isMockPath: boolean;
    principles: string[];
    aiRules: string[];
    protectedPaths: string[];
    forbiddenActions: string[];
    relevantRuleCount: number;
}
export declare function getRelevantGovernanceForFile(workspaceRoot: string, activeFile?: string): Promise<RelevantGovernanceForFile>;
export declare function buildGovernanceInjectPreview(relevant: RelevantGovernanceForFile): string;
export declare function compileGovernanceInjectPrompt(input: GovernanceInjectInput, mode: GovernanceInjectMode): Promise<string>;
//# sourceMappingURL=governanceInject.d.ts.map