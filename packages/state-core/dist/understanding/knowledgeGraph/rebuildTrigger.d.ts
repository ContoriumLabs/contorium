export type KnowledgeRebuildTrigger = 'git_commit' | 'file_batch' | 'intent_change' | 'idle' | 'initial' | 'change';
export interface RebuildTriggerInput {
    changedFileCount: number;
    intentChanged: boolean;
    lastBuildAt?: number;
    now: number;
    hasNewCommit?: boolean;
    isInitial?: boolean;
}
/** When to rebuild knowledge.json (Closure §9.3). */
export declare function resolveKnowledgeRebuildTrigger(input: RebuildTriggerInput): KnowledgeRebuildTrigger;
export declare function shouldRebuildKnowledgeGraph(input: RebuildTriggerInput): boolean;
//# sourceMappingURL=rebuildTrigger.d.ts.map