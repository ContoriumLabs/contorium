import type { ValiditySignalType } from './types.js';

/** Confidence decay penalties per invalidation signal (优化.md §四). */
export const DECAY_PENALTIES: Record<ValiditySignalType, number> = {
  CODE_CHANGE: 40,
  DEPENDENCY_CHANGE: 20,
  DEPENDENCY_REMOVAL: 30,
  OWNER_CHANGE: 15,
  ASSUMPTION_FAILURE: 50,
  ARCHITECTURE_CHANGE: 35,
  ADR_CONFLICT: 25,
  SUPERSEDED: 0,
};

export function decayPenaltyForSignals(
  signals: Array<{ type: ValiditySignalType; severity: string }>,
): number {
  let penalty = 0;
  for (const s of signals) {
    const base = DECAY_PENALTIES[s.type] ?? 10;
    const mult = s.severity === 'critical' ? 1.2 : s.severity === 'high' ? 1 : s.severity === 'medium' ? 0.7 : 0.4;
    penalty += Math.round(base * mult);
  }
  return Math.min(80, penalty);
}

export function invalidationScoreFromPenalty(penalty: number): number {
  return Math.max(0, Math.min(100, penalty));
}
