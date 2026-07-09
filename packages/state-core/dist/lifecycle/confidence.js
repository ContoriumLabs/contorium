"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDecisionConfidence = computeDecisionConfidence;
const evolution_js_1 = require("./evolution.js");
const policy_js_1 = require("./policy.js");
function clamp100(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
}
function daysSince(iso) {
    if (!iso) {
        return 999;
    }
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) {
        return 999;
    }
    return (Date.now() - parsed) / (24 * 60 * 60 * 1000);
}
function computeDecisionConfidence(adr, meta, conflictRefs, freshnessScore, decayPenalty = 0) {
    const source = clamp100((adr.reason.length > 20 ? 40 : 20) +
        (adr.related_events.length ? Math.min(40, adr.related_events.length * 10) : 0) +
        (adr.alternatives.length ? 20 : 0));
    const freshness = clamp100(freshnessScore);
    const conflict = clamp100(conflictRefs.length
        ? Math.max(5, 100 - conflictRefs.length * policy_js_1.LIFECYCLE_POLICY.confidenceConflictPenalty)
        : 100);
    const ownership = clamp100(meta.owner?.trim() ? 100 : 40);
    const verifiedDays = daysSince(meta.verified_at ?? adr.last_verified);
    const verification = clamp100(meta.verification_type === 'manual'
        ? 100
        : meta.verification_type === 'automatic'
            ? 85
            : adr.last_verified
                ? Math.max(15, 100 - verifiedDays * 0.5)
                : 25);
    const lc = (0, evolution_js_1.mapAdrToLifecycleStatus)(adr.status);
    const consistency = clamp100(lc === 'ACTIVE' ? 100 : lc === 'SUPERSEDED' ? 35 : lc === 'DEPRECATED' ? 15 : 50);
    const usage = clamp100(Math.min(100, 30 + adr.related_events.length * 12));
    const rawOverall = source * 0.15 +
        freshness * 0.2 +
        conflict * 0.2 +
        ownership * 0.1 +
        verification * 0.15 +
        consistency * 0.1 +
        usage * 0.1;
    const overall = clamp100(rawOverall - decayPenalty);
    return { source, freshness, conflict, ownership, verification, consistency, usage, overall };
}
