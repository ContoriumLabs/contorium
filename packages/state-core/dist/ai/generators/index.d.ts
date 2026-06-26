import type { TransferStoryPayload, ProjectEssence, ProjectDna } from '../../cil/types.js';
export declare function generateWhyExplanation(workspaceRoot: string, input: {
    question: string;
    decision?: string;
    reason?: string;
    date?: string;
    events?: string[];
    adrs?: string[];
}): Promise<string | null>;
export declare function generateStoryWithAi(workspaceRoot: string): Promise<TransferStoryPayload & {
    llm_enhanced?: boolean;
}>;
export declare function generateEssenceWithAi(workspaceRoot: string): Promise<ProjectEssence & {
    llm_enhanced?: boolean;
}>;
export declare function generateDnaWithAi(workspaceRoot: string): Promise<ProjectDna & {
    llm_enhanced?: boolean;
}>;
export declare function enhanceAskAnswer(workspaceRoot: string, question: string, ruleAnswer: string, facts?: string[]): Promise<string | null>;
//# sourceMappingURL=index.d.ts.map