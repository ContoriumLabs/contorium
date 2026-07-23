export declare const CHANGE_EVENT_SCHEMA: "contorium.change_events.v1";
export type ChangeEventType = 'CODE_CHANGE' | 'DEPENDENCY_CHANGE' | 'DEPENDENCY_REMOVAL' | 'ARCHITECTURE_CHANGE' | 'OWNER_CHANGE' | 'BUSINESS_CHANGE';
export type ChangeEventSource = 'git' | 'ide' | 'mcp' | 'filesystem' | 'dependency' | 'human' | 'cognitive' | 'candidate';
export interface ChangeEvent {
    id: string;
    type: ChangeEventType;
    source: ChangeEventSource;
    time: string;
    files?: string[];
    detail?: string;
    /** Present for AI-inferred candidate events (优化.md §4.1 C). */
    confidence?: number;
    status?: 'confirmed' | 'candidate';
}
/** Collect unified change events from git, deps, cognitive events, and candidates (优化.md §4.1). */
export declare function collectChangeEvents(workspaceRoot: string): Promise<ChangeEvent[]>;
//# sourceMappingURL=changeEventEngine.d.ts.map