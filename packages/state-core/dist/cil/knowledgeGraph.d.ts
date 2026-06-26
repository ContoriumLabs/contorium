import type { AdrRecord, CognitiveEvent, KnowledgeEntityIndex, KnowledgeEntityRecord, ProjectSnapshotRecord } from './types.js';
/** Build entity → artifact links from CIL storage (projection, not SoT). */
export declare function buildKnowledgeGraph(events: CognitiveEvent[], adrs: AdrRecord[], snapshots: ProjectSnapshotRecord[]): Map<string, KnowledgeEntityRecord>;
export declare function syncKnowledgeGraph(workspaceRoot: string, events: CognitiveEvent[], adrs: AdrRecord[], snapshots: ProjectSnapshotRecord[]): Promise<KnowledgeEntityIndex>;
export declare function readKnowledgeEntityIndex(workspaceRoot: string): Promise<KnowledgeEntityIndex | null>;
export declare function readKnowledgeEntity(workspaceRoot: string, entityQuery: string): Promise<KnowledgeEntityRecord | null>;
export declare function exploreEntityKnowledge(workspaceRoot: string, entityQuery: string): Promise<{
    entity: string;
    record: KnowledgeEntityRecord | null;
    formatted: string[];
}>;
//# sourceMappingURL=knowledgeGraph.d.ts.map