export interface McpStateConflictSource {
    source: string;
    detail: string;
}
export interface McpStateConflict {
    id: string;
    type: string;
    title: string;
    sources: McpStateConflictSource[];
    status: string;
    action: string;
    detectedAt: number;
}
export interface McpConflictsArtifact {
    version: number;
    generatedAt: number;
    conflicts: McpStateConflict[];
}
export declare function loadStateConflicts(workspaceRoot: string): Promise<McpConflictsArtifact | null>;
