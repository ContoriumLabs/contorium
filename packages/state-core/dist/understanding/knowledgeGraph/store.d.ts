import type { KnowledgeSnapshot, ProjectKnowledgeGraph } from './types.js';
export declare function readProjectKnowledgeGraph(workspaceRoot: string): Promise<ProjectKnowledgeGraph | undefined>;
/** Snapshot Layer — compact graph summary for Handoff / MCP. */
export declare function readKnowledgeSnapshot(workspaceRoot: string): Promise<KnowledgeSnapshot | undefined>;
export declare function writeProjectKnowledgeGraph(workspaceRoot: string, graph: ProjectKnowledgeGraph): Promise<void>;
export declare function deleteProjectKnowledgeGraph(workspaceRoot: string): Promise<void>;
//# sourceMappingURL=store.d.ts.map