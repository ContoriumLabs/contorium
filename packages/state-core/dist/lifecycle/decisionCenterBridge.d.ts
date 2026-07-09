import type { KnowledgeLifecycleIndex } from './types.js';
/** Append lifecycle trust overlay to Decision Center formatted output. */
export declare function appendLifecycleTrustOverlay(formatted: string[], index: KnowledgeLifecycleIndex | null | undefined): string[];
/** Short superseded preamble for Ask decision answers. */
export declare function formatSupersededDecisionPreamble(record: Pick<import('./types.js').DecisionLifecycleRecord, 'title' | 'lifecycle_status' | 'created_at' | 'superseded_by' | 'evolution_chain'>): string | undefined;
//# sourceMappingURL=decisionCenterBridge.d.ts.map