import type { DriftReport, ProjectIntentKernel } from '../pik/types.js';
export interface FusedSemanticContext {
    project_core_direction: string;
    primary_intent_statement: string;
    current_alignment_score: number;
    drift: DriftReport;
    goal_hierarchy: Array<{
        goal: string;
        weight: number;
    }>;
    current_focus?: string;
    recommended_next_focus: string[];
    reasoning_trace: string[];
    sources: string[];
}
export declare function fuseSemanticContext(workspaceRoot: string, question: string, pik: ProjectIntentKernel): Promise<FusedSemanticContext>;
//# sourceMappingURL=fusion.d.ts.map