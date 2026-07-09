export declare const LIFECYCLE_POLICY: {
    readonly defaultExpireDays: 180;
    readonly staleVerifyDays: 60;
    readonly maxReviewQueueItems: 32;
    readonly reviewDebtPenaltyPerItem: 8;
    readonly conflictPenaltyPerDecision: 25;
    readonly confidenceConflictPenalty: 35;
    readonly codeScanMaxFiles: 24;
    readonly codeScanMaxBytesPerFile: 160000;
};
export type LifecyclePolicy = typeof LIFECYCLE_POLICY;
//# sourceMappingURL=policy.d.ts.map