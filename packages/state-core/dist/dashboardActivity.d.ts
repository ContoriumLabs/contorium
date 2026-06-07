import type { AdapterKind } from './types.js';
export type WorkspaceActivityKind = 'file_change' | 'function_change' | 'git_change' | 'sync' | 'event';
export interface WorkspaceActivityBump {
    at: number;
    source: AdapterKind;
    kind: WorkspaceActivityKind;
    detail?: string;
}
/** Record workspace activity — universal trigger for dashboard auto-attach (IDE / MCP / CLI). */
export declare function bumpWorkspaceActivity(workspaceRoot: string, bump: Omit<WorkspaceActivityBump, 'at'>): Promise<void>;
export declare function readWorkspaceActivity(workspaceRoot: string): Promise<WorkspaceActivityBump | undefined>;
//# sourceMappingURL=dashboardActivity.d.ts.map