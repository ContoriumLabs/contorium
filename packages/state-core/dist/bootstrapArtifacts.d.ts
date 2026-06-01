import type { BootstrapStateJson, WorkspaceScanFacts } from './types.js';
export interface BootstrapProjectBuiltState {
    version: 1;
    engine_version: 2;
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
export declare function buildBootstrapProjectState(scan: WorkspaceScanFacts, state?: BootstrapStateJson): BootstrapProjectBuiltState;
export declare function writeBootstrapArtifacts(workspaceRoot: string, scan: WorkspaceScanFacts, state?: BootstrapStateJson): Promise<void>;
//# sourceMappingURL=bootstrapArtifacts.d.ts.map