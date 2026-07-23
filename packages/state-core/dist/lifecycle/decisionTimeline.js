"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDecisionTimeline = formatDecisionTimeline;
const invalidation_js_1 = require("./invalidation.js");
/** Decision Timeline — project as a sequence of choices (优化.md V5 §二.2). */
function formatDecisionTimeline(adrs, lifecycle) {
    const byId = new Map((lifecycle?.decisions ?? []).map((d) => [d.decision_id, d]));
    const sorted = [...adrs]
        .filter((a) => a.status !== 'rejected')
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id));
    const lines = ['Decision Timeline', '', 'Project evolution as a series of choices', ''];
    if (!sorted.length) {
        lines.push('(no decisions recorded — capture one with contorium capture decision)');
        return lines;
    }
    for (let i = 0; i < sorted.length; i++) {
        const adr = sorted[i];
        const rec = byId.get(adr.id);
        const when = (adr.date || '').slice(0, 7) || '????-??';
        lines.push(when, adr.title);
        if (adr.reason?.trim()) {
            lines.push(`  Why: ${adr.reason.trim().slice(0, 120)}`);
        }
        if (rec) {
            lines.push(`  Health: ${(0, invalidation_js_1.formatValidityStateLabel)(rec.validity_state)} · trust ${rec.confidence.overall}%`);
            const why = rec.validity_signals[0]?.reason ?? rec.invalidation_reason_chain?.[1]?.event;
            if (why && rec.validity_state !== 'VALID') {
                lines.push(`  Signal: ${why.slice(0, 100)}`);
            }
        }
        else {
            lines.push(`  Status: ${adr.status}`);
        }
        lines.push('');
        if (i < sorted.length - 1) {
            lines.push('↓', '');
        }
    }
    return lines;
}
