import type { DecisionLifecycleRecord, KnowledgeLifecycleIndex } from './types.js';
/** Attach stale-trust warnings when history/entity/state answers touch aged decisions. */
export declare function formatLifecycleTrustWarnings(index: KnowledgeLifecycleIndex | null | undefined, answerText: string, intent: string): string | undefined;
export declare function appendLifecycleTrustWarnings(workspaceRoot: string, answer: string, intent: string): Promise<string>;
/** Resolve lifecycle record for IDE owner/verify pickers. */
export declare function listLifecycleDecisionsForPicker(workspaceRoot: string): Promise<Array<{
    id: string;
    label: string;
    record: DecisionLifecycleRecord;
}>>;
export declare function findLifecycleRecordByPickerId(workspaceRoot: string, decisionId: string): Promise<DecisionLifecycleRecord | undefined>;
//# sourceMappingURL=askHints.d.ts.map