import type { DecisionLifecycleRecord, KnowledgeLifecycleIndex, ReviewQueueItem } from './types.js';
export declare function buildReviewQueue(records: DecisionLifecycleRecord[]): ReviewQueueItem[];
/** Compute full Knowledge Lifecycle projection from CIL ADRs. */
export declare function computeKnowledgeLifecycle(workspaceRoot: string): Promise<KnowledgeLifecycleIndex>;
export declare function formatReviewQueue(index: KnowledgeLifecycleIndex): string[];
export declare function findDecisionLifecycle(index: KnowledgeLifecycleIndex, decisionIdOrTopic: string): DecisionLifecycleRecord | undefined;
/** Format lifecycle trust block for Ask decision answers. */
export declare function formatDecisionLifecycleAnswer(record: DecisionLifecycleRecord, adrs: import('../cil/types.js').AdrRecord[]): string;
//# sourceMappingURL=engine.d.ts.map