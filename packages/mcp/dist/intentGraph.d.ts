export interface McpIntentGraph {
    version: number;
    updatedAt: number;
    nodes: Array<{
        id: string;
        text: string;
        status: string;
        confidence: number;
        relatedFiles: string[];
        lastUpdated: number;
        learnedAt: number;
    }>;
    edges: Array<{
        from: string;
        to: string;
        type: string;
    }>;
}
export declare function loadIntentGraph(workspaceRoot: string): Promise<McpIntentGraph | null>;
export declare function activeIntentNodes(graph: McpIntentGraph, max?: number): McpIntentGraph['nodes'];
