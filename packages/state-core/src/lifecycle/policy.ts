export const LIFECYCLE_POLICY = {
  defaultExpireDays: 180,
  staleVerifyDays: 60,
  maxReviewQueueItems: 32,
  reviewDebtPenaltyPerItem: 8,
  conflictPenaltyPerDecision: 25,
  confidenceConflictPenalty: 35,
  codeScanMaxFiles: 24,
  codeScanMaxBytesPerFile: 160_000,
} as const;

export type LifecyclePolicy = typeof LIFECYCLE_POLICY;
