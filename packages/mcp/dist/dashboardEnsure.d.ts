export interface CliSpawnPlan {
    command: string;
    args: string[];
}
/** Resolve contorium CLI for bootstrap/wake — monorepo dev, bundled helper, or npx fallback. */
export declare function resolveContoriumSpawn(subcommand: string, workspaceRoot: string, extraArgs?: string[]): CliSpawnPlan;
/** CRBP — MCP client initialize → bootstrap runtime attach. */
export declare function scheduleMcpRuntimeBootstrap(workspaceRoot: string): void;
/** Activity update after bootstrap (file/git events). */
export declare function scheduleMcpDashboardWake(workspaceRoot: string, detail?: string): void;
