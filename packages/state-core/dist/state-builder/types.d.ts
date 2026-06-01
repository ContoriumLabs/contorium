/** State Builder — AI-agnostic project state (`.contora/state-builder/project-state.json`). */
export interface ProjectBuiltState {
    version: 1;
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
export declare const PROJECT_BUILT_STATE_VERSION: 1;
export declare function emptyProjectBuiltState(now?: number): ProjectBuiltState;
//# sourceMappingURL=types.d.ts.map