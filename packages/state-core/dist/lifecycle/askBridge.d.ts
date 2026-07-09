import type { DecisionLifecycleRecord } from './types.js';
/** Lifecycle filter — enrich decision Ask answers with trust metadata (优化.md §11). */
export declare function enrichDecisionAskAnswer(workspaceRoot: string, baseAnswer: string, match?: {
    id?: string;
    title?: string;
}, topic?: string): Promise<{
    answer: string;
    lifecycle?: DecisionLifecycleRecord;
}>;
/** Extract decision ids/titles referenced in kernel structured results (for lifecycle filtering). */
export declare function extractDecisionRefsFromAskResult(intent: string, data: Record<string, unknown> | undefined): string[];
//# sourceMappingURL=askBridge.d.ts.map