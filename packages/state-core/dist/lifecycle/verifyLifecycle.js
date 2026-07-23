"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLifecycleVerification = applyLifecycleVerification;
/** Apply verify semantics: reset owner-change decay, record evidence (优化.md §10). */
function applyLifecycleVerification(existing, input = {}) {
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
