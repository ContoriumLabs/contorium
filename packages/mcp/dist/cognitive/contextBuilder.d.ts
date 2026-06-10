export interface WorkspaceContext {
    workspaceRoot: string;
    currentTask: string;
    recentFiles: string[];
    changedFiles: string[];
    keyChangeSymbols: string[];
    focusHint: string;
    projectType: string;
    fileTypes: string[];
    paths: string[];
}
export declare function buildWorkspaceContext(workspaceRoot: string): Promise<WorkspaceContext>;
