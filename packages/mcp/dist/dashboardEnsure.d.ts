export interface CliSpawnPlan {
    command: string;
    args: string[];
}
/** Resolve contorium CLI spawn plan — node + .cjs only (never npx/npm exec). */
export declare function resolveContoriumSpawn(subcommand: string, workspaceRoot: string, extraArgs?: string[]): CliSpawnPlan | undefined;
/** @deprecated Use ensureMcpDashboardAttached — kept for legacy callers. */
export declare function scheduleMcpRuntimeBootstrap(workspaceRoot: string): void;
/** Activity update after bootstrap (file/git events). */
export declare function scheduleMcpDashboardWake(workspaceRoot: string, detail?: string): void;
