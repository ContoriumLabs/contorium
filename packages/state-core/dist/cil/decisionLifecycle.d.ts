import type { AdrRecord } from './types.js';
/** Infer implemented when accepted ADR has linked implementation events. */
export declare function applyImplementedStatus(adrs: AdrRecord[]): AdrRecord[];
/** Resolve "Why not X?" using superseded chain. */
export declare function resolveDecisionByTopic(adrs: AdrRecord[], topic: string): {
    answer: string;
    adr?: AdrRecord;
    chain: string[];
};
export declare function formatLifecycleStatus(status: AdrRecord['status']): string;
//# sourceMappingURL=decisionLifecycle.d.ts.map