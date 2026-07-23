import { formatValidityStateLabel } from '@contora/state-core';
import { truncate } from './uiHelpers.js';
function reviewItemLabel(item) {
    const days = item.days != null ? ` ${item.days}d` : '';
    if (item.reason === 'invalidation_trigger' && item.trigger_type) {
        return `${item.reason}:${item.trigger_type}${days}`;
    }
    return `${item.reason}${days}`;
}
function topValiditySignal(record) {
    const top = [...(record.validity_signals ?? [])].sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 };
        return rank[b.severity] - rank[a.severity];
    })[0];
    if (!top || record.validity_state === 'VALID') {
        return undefined;
    }
    return `${top.type}: ${top.reason}`;
}
/** Knowledge Governance summary for dashboard (优化.md §12). */
export function renderKnowledgeGovernanceLines(state, useColor, width) {
    const lc = state.knowledgeLifecycle;
    if (!lc?.health) {
        return ['(run contorium sync — lifecycle not built yet)'];
    }
    const h = lc.health;
    const lines = [
        `Knowledge Health: ${h.score}% | Review queue: ${lc.review_queue.length}`,
        `Fresh ${h.dimensions.freshness}% · Conflict ${h.dimensions.conflict}% · Review debt ${h.dimensions.review_debt}%`,
        `Expired ${h.expired_decisions} · Stale ${h.stale_decisions} · Unverified ${h.unverified_count} · Missing owner ${h.missing_owner_count}`,
    ];
    const fresh = lc.decisions.filter((r) => r.freshness_score >= 70 && !r.needs_review);
    const stale = lc.decisions.filter((r) => r.freshness_score < 50 || r.expired);
    const conflicted = lc.decisions.filter((r) => r.conflict_refs.length > 0);
    const unverified = lc.decisions.filter((r) => !r.last_verified_at);
    const missingOwner = lc.decisions.filter((r) => !r.meta.owner);
    const invalidated = lc.decisions.filter((r) => r.validity_state === 'INVALIDATED');
    const needsRevalidation = lc.decisions.filter((r) => r.validity_state === 'NEEDS_REVALIDATION');
    const suspected = lc.decisions.filter((r) => r.validity_state === 'SUSPECTED_INVALID');
    const decaying = lc.decisions.filter((r) => r.validity_state === 'DECAYING');
    const warning = lc.decisions.filter((r) => r.validity_state === 'WARNING');
    const validCount = lc.decisions.filter((r) => r.validity_state === 'VALID').length;
    const validityHealth = h.decision_validity_health;
    lines.push(`Fresh decisions: ${fresh.length} · Stale: ${stale.length} · Conflicts: ${conflicted.length}`);
    lines.push(`Validity: valid ${validCount} · warning ${warning.length} · decaying ${decaying.length} · suspected ${suspected.length} · revalidate ${needsRevalidation.length} · invalidated ${invalidated.length}`);
    if (validityHealth?.unresolved_impacts) {
        lines.push(`Unresolved impacts: ${validityHealth.unresolved_impacts}`);
    }
    lines.push(`Needs review: ${lc.review_queue.length} · Missing owners: ${missingOwner.length} · Unverified: ${unverified.length}`);
    const topReview = lc.review_queue.slice(0, 3);
    for (const item of topReview) {
        lines.push(`! [${item.severity}] ${item.title} (${reviewItemLabel(item)})`);
    }
    const flaggedValidity = lc.decisions
        .filter((r) => r.validity_state && r.validity_state !== 'VALID')
        .slice(0, 2);
    for (const r of flaggedValidity) {
        const why = topValiditySignal(r);
        lines.push(`⚠ ${r.title} — ${formatValidityStateLabel(r.validity_state)} · trust ${r.confidence.overall}%`);
        if (why) {
            lines.push(`  ${why}`);
        }
    }
    if (!topReview.length) {
        lines.push('Review queue clear');
    }
    const verified = lc.decisions.filter((r) => r.meta.verified_at).length;
    lines.push(`Verification: ${verified}/${lc.decisions.length} recorded`);
    if (useColor) {
        return lines.map((l) => truncate(l, width));
    }
    return lines.map((l) => truncate(l, width));
}
export function knowledgeLifecycleSummary(lc) {
    if (!lc?.health) {
        return 'Lifecycle: —';
    }
    const q = lc.review_queue.length;
    return `Knowledge ${lc.health.score}% · Review ${q}`;
}
/** Layered health — Lifecycle · PIL · Cognitive (优化.md §12). */
export function renderLayeredHealthLines(state, width) {
    const lines = [];
    const lc = state.knowledgeLifecycle;
    const pil = state.intelligenceHealth?.metrics;
    const cog = state.cognitiveHealthScore;
    if (lc?.health) {
        const h = lc.health;
        const invalidated = lc.decisions.filter((r) => r.validity_state === 'INVALIDATED').length;
        const revalidate = lc.decisions.filter((r) => r.validity_state === 'NEEDS_REVALIDATION').length;
        const suspected = lc.decisions.filter((r) => r.validity_state === 'SUSPECTED_INVALID').length;
        lines.push(`Knowledge Lifecycle: ${h.score}% (fresh ${h.dimensions.freshness}% · review debt ${h.dimensions.review_debt}%)`);
        if (invalidated || revalidate || suspected) {
            lines.push(`  Validity alerts: invalidated ${invalidated} · suspected ${suspected} · needs revalidation ${revalidate}`);
        }
        if (lc.review_queue.length) {
            lines.push(`  Review queue: ${lc.review_queue.length} · expired ${h.expired_decisions} · stale ${h.stale_decisions}`);
        }
    }
    if (pil) {
        lines.push(`Project Intelligence: ${Math.round(pil.health_score * 100)}% ${pil.health_category ?? ''}`.trim());
    }
    if (cog != null && Number.isFinite(cog)) {
        lines.push(`Cognitive Health: ${Math.round(cog)}%`);
    }
    if (!lines.length) {
        return ['(run contorium sync for layered health)'];
    }
    return lines.map((l) => truncate(l, width));
}
