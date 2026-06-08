export interface RunGitOptions {
    timeout?: number;
    maxBuffer?: number;
    /** Bypass runtime gate (CLI sync / explicit refresh only). */
    force?: boolean;
}
/** Resolve real git.exe on Windows — never git.cmd (opens console). */
export declare function resolveGitExecutable(): string;
/** Run git in workspace root — deferred until runtime activity unless forced. */
export declare function runGit(workspaceRoot: string, gitArgs: string[], options?: RunGitOptions): Promise<string>;
//# sourceMappingURL=runGit.d.ts.map