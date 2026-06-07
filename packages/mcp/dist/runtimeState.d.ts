export interface RuntimeStateSnapshot {
    workspaceRoot: string;
    bootstrap?: Record<string, unknown>;
    dashboard?: Record<string, unknown>;
    session?: Record<string, unknown>;
    stateSummary?: {
        mode: string;
        currentTask: string;
        lastWriter?: string;
        eventCount: number;
    };
}
/** Standard MCP tool: worker / session / bootstrap view (read-only). */
export declare function readRuntimeState(workspaceRoot: string): Promise<RuntimeStateSnapshot>;
