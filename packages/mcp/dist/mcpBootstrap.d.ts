/** MCP startup bootstrap. */
export declare function ensureWorkspaceBootstrapped(workspaceRoot: string): Promise<{
    bootstrapped: boolean;
    mode: string;
}>;
/** Light sync: 5s poll + watch events dir and git HEAD. */
export declare function startMcpLightSync(workspaceRoot: string): void;
export declare function stopMcpLightSync(): void;
