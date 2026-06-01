import type { IntentGraphStatus } from './types';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function confidenceToStatus(confidence: number): IntentGraphStatus {
  if (confidence > 0.7) {
    return 'ACTIVE';
  }
  if (confidence >= 0.5) {
    return 'WEAKENING';
  }
  if (confidence >= 0.3) {
    return 'PARTIAL';
  }
  if (confidence >= 0.12) {
    return 'STALE';
  }
  return 'ARCHIVED';
}

export interface LifecycleInput {
  baseConfidence: number;
  learnedAt: number;
  lastUpdated: number;
  lastConfirmedAt: number;
  relatedFileHits: number;
  unrelatedDriftHits: number;
  taskAligned: boolean;
  now?: number;
}

/** Industrial lifecycle: time decay + drift penalty + activity boost. */
export function evaluateNodeConfidence(input: LifecycleInput): number {
  const now = input.now ?? Date.now();
  const daysSinceConfirm = (now - input.lastConfirmedAt) / (24 * 60 * 60 * 1000);
  const timeDecay = Math.min(0.35, daysSinceConfirm * 0.04);
  const fileDriftPenalty = Math.min(0.25, input.unrelatedDriftHits * 0.06);
  const activityBoost = Math.min(0.2, input.relatedFileHits * 0.04);
  const taskBoost = input.taskAligned ? 0.08 : -0.1;
  let c = input.baseConfidence - timeDecay - fileDriftPenalty + activityBoost + taskBoost;
  if (now - input.lastUpdated > 7 * 24 * 60 * 60 * 1000) {
    c -= 0.08;
  }
  return clamp01(c);
}

export function applyLifecycle(
  confidence: number,
  input: Omit<LifecycleInput, 'baseConfidence'>,
): { confidence: number; status: IntentGraphStatus } {
  const next = evaluateNodeConfidence({ ...input, baseConfidence: confidence });
  return { confidence: Math.round(next * 1000) / 1000, status: confidenceToStatus(next) };
}
