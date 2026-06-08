/** Find sessionrecall monorepo root from MCP entry or env. */
export declare function findMonorepoRoot(): string | undefined;
/** Resolve contorium.cjs — never npx/npm exec (Windows console flash). */
export declare function resolveContoriumCliBinary(): string | undefined;
export declare function resolveCliDistModule(relativePath: string): string | undefined;
