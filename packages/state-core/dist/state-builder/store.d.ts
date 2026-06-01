import { type ProjectBuiltState } from './types.js';
export declare function builderDir(workspaceRoot: string): string;
export declare function parseProjectBuiltState(raw: unknown): ProjectBuiltState | undefined;
export declare function readProjectBuiltState(workspaceRoot: string): Promise<ProjectBuiltState | undefined>;
export declare function readProjectSnapshotMarkdown(workspaceRoot: string): Promise<string | undefined>;
export declare function writeProjectBuiltState(workspaceRoot: string, built: ProjectBuiltState, snapshotMarkdown?: string): Promise<void>;
//# sourceMappingURL=store.d.ts.map