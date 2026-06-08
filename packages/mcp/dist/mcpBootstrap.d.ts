/** MCP startup bootstrap — no git.exe (uses cached state.json git fields). */
export declare function ensureWorkspaceBootstrapped(workspaceRoot: string): Promise<{
    bootstrapped: boolean;
    mode: string;
}>;
/** Light sync: poll + watch — git only after startup quiet window on HEAD change. */
export declare function startMcpLightSync(workspaceRoot: string): boolean;
export declare function stopMcpLightSync(): void;
