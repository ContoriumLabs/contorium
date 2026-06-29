import type { AskProjectResult } from './types.js';
/** Ask Contorium v2 — PIK + semantic fusion, then cognitive kernel. */
export declare function askProject(workspaceRoot: string, question: string): Promise<AskProjectResult>;
export declare function getProjectStory(workspaceRoot: string): Promise<{
    story: string;
    formatted: string[];
}>;
/** @deprecated prefer runCognitiveKernel — kept for legacy callers */
export declare function getProjectStoryLegacy(workspaceRoot: string): Promise<{
    story: string;
    formatted: string[];
}>;
//# sourceMappingURL=queryEngine.d.ts.map