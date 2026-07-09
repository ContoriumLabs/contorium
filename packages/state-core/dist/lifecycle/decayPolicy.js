"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECAY_PENALTIES = void 0;
exports.decayPenaltyForSignals = decayPenaltyForSignals;
exports.invalidationScoreFromPenalty = invalidationScoreFromPenalty;
/** Confidence decay penalties per invalidation signal (优化.md §四). */
exports.DECAY_PENALTIES = {
    CODE_CHANGE: 40,
    DEPENDENCY_CHANGE: 20,
    DEPENDENCY_REMOVAL: 30,
    OWNER_CHANGE: 15,
    ASSUMPTION_FAILURE: 50,
    ARCHITECTURE_CHANGE: 35,
    ADR_CONFLICT: 25,
    SUPERSEDED: 0,
};
function decayPenaltyForSignals(signals) {
    let penalty = 0;
    for (const s of signals) {
        const base = exports.DECAY_PENALTIES[s.type] ?? 10;
        const mult = s.severity === 'critical' ? 1.2 : s.severity === 'high' ? 1 : s.severity === 'medium' ? 0.7 : 0.4;
        penalty += Math.round(base * mult);
    }
    return Math.min(80, penalty);
}
function invalidationScoreFromPenalty(penalty) {
    return Math.max(0, Math.min(100, penalty));
}
