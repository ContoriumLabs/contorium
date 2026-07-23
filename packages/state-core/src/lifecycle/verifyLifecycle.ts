import type { DecisionLifecycleMeta, VerificationType } from './types.js';

export interface LifecycleVerifyInput {
  by?: string;
  type?: VerificationType;
  /** Human-readable reason the decision still holds (优化.md §10). */
  reason?: string;
  /** Evidence supporting revalidation. */
  evidence?: string;
}

/** Apply verify semantics: reset owner-change decay, record evidence (优化.md §10). */
export function applyLifecycleVerification(
  existing: DecisionLifecycleMeta,
  input: LifecycleVerifyInput = {},
): DecisionLifecycleMeta {
  const now = new Date().toISOString();
  const evidence = input.evidence?.trim();
  const priorEvidence = existing.verification_evidence ?? [];
  const nextEvidence = evidence ? [evidence, ...priorEvidence].slice(0, 8) : priorEvidence;

  return {
    ...existing,
    verified_at: now,
    verified_by: input.by?.trim() || existing.verified_by || 'cli',
    verification_type: input.type ?? existing.verification_type ?? 'manual',
    verified_reason: input.reason?.trim() || existing.verified_reason,
    verification_evidence: nextEvidence.length ? nextEvidence : undefined,
    previous_owner: undefined,
    owner_changed_at: undefined,
    last_invalidation_reset_at: now,
  };
}
