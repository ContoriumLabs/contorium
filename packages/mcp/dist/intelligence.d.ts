export interface McpStateSummary {
    version: number;
    generatedAt: number;
    project_intent: string;
    current_focus: string;
    active_domains: string[];
    active_problem_area: string;
    activity_clusters: Array<{
        cluster: string;
        files: string[];
        weight: number;
    }>;
    next_likely_actions: string[];
    confidence: number;
}
export declare function loadProjectIntelligence(workspaceRoot: string): Promise<McpStateSummary | null>;
