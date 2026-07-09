import type { ValiditySignalType } from './types.js';
/** Confidence decay penalties per invalidation signal (优化.md §四). */
export declare const DECAY_PENALTIES: Record<ValiditySignalType, number>;
export declare function decayPenaltyForSignals(signals: Array<{
    type: ValiditySignalType;
    severity: string;
}>): number;
export declare function invalidationScoreFromPenalty(penalty: number): number;
//# sourceMappingURL=decayPolicy.d.ts.map