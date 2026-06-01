export interface McpProjectBuiltState {
    version: number;
    engine_version?: number;
    generatedAt: number;
    task_anchor?: string;
    project_goal: string;
    current_stage: string;
    active_modules: string[];
    recent_decisions: string[];
    open_problems: string[];
    completed_milestones: string[];
    next_actions: string[];
    confidence: number;
}
export declare function loadProjectBuiltState(workspaceRoot: string): Promise<McpProjectBuiltState | null>;
export declare function loadProjectSnapshotMarkdown(workspaceRoot: string): Promise<string | null>;
