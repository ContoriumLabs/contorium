import type { DecisionLifecycleMeta, KnowledgeLifecycleIndex, ReviewQueueArtifact } from './types.js';
export declare function persistKnowledgeLifecycle(workspaceRoot: string): Promise<KnowledgeLifecycleIndex>;
export declare function readKnowledgeLifecycle(workspaceRoot: string): Promise<KnowledgeLifecycleIndex | null>;
export declare function readReviewQueueArtifact(workspaceRoot: string): Promise<ReviewQueueArtifact | null>;
export declare function writeDecisionLifecycleMeta(workspaceRoot: string, decisionId: string, meta: DecisionLifecycleMeta): Promise<void>;
export declare function readDecisionLifecycleMeta(workspaceRoot: string, decisionId: string): Promise<DecisionLifecycleMeta | null>;
//# sourceMappingURL=store.d.ts.map