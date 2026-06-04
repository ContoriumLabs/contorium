import { type GraphMetadata, type ProjectKnowledgeGraph } from './types.js';
export declare function buildGraphMetadata(args: {
    workspaceRoot: string;
    now: number;
    sourceVersion?: string;
    rebuildTrigger?: string;
    lastCommitHash?: string;
}): GraphMetadata;
/** schemaVersion switch — upgrade legacy graphs on read. */
export declare function normalizeKnowledgeGraph(raw: unknown, workspaceRoot?: string): ProjectKnowledgeGraph | undefined;
//# sourceMappingURL=normalize.d.ts.map