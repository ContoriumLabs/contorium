"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIFECYCLE_POLICY = void 0;
exports.LIFECYCLE_POLICY = {
    defaultExpireDays: 180,
    staleVerifyDays: 60,
    maxReviewQueueItems: 32,
    reviewDebtPenaltyPerItem: 8,
    conflictPenaltyPerDecision: 25,
    confidenceConflictPenalty: 35,
    codeScanMaxFiles: 24,
    codeScanMaxBytesPerFile: 160_000,
};
