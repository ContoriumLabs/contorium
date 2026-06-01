export interface McpStateSummary {
    version: 1;
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
export interface McpIntentGraphNode {
    id: string;
    text: string;
    status: string;
    confidence: number;
    relatedFiles: string[];
    lastUpdated: number;
}
export interface McpIntentGraph {
    version: 1;
    updatedAt: number;
    nodes: McpIntentGraphNode[];
    edges: Array<{
        from: string;
        to: string;
        type: string;
        weight?: number;
    }>;
}
export declare function loadProjectIntelligence(workspaceRoot: string): Promise<{
    found: boolean;
    summary?: McpStateSummary;
    path: string;
}>;
export declare function loadIntentGraph(workspaceRoot: string): Promise<{
    found: boolean;
    graph?: McpIntentGraph;
    path: string;
}>;
export declare function filterActiveIntentNodes(graph: McpIntentGraph): McpIntentGraphNode[];
