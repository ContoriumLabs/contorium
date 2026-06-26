"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyImplementedStatus = applyImplementedStatus;
exports.resolveDecisionByTopic = resolveDecisionByTopic;
exports.formatLifecycleStatus = formatLifecycleStatus;
const LIFECYCLE_ORDER = [
    'proposed',
    'accepted',
    'implemented',
    'superseded',
    'deprecated',
    'rejected',
];
/** Infer implemented when accepted ADR has linked implementation events. */
function applyImplementedStatus(adrs) {
    return adrs.map((adr) => {
        if (adr.status === 'accepted' && adr.related_events.length > 0) {
            return { ...adr, status: 'implemented' };
        }
        return adr;
    });
}
function tokenMatch(text, needle) {
    const n = needle.toLowerCase().replace(/[^\w]+/g, ' ').trim();
    if (!n) {
        return false;
    }
    const t = text.toLowerCase();
    return n.split(/\s+/).every((part) => part.length < 3 || t.includes(part));
}
/** Resolve "Why not X?" using superseded chain. */
function resolveDecisionByTopic(adrs, topic) {
    const needle = topic.replace(/^why\s+(not|wasn't|isn't)\s+/i, '').replace(/\?$/, '').trim();
    const match = adrs.find((a) => tokenMatch(a.title, needle) || tokenMatch(a.reason, needle)) ??
        adrs.find((a) => a.alternatives.some((alt) => tokenMatch(alt, needle)));
    if (!match) {
        return { answer: `No decision record found for "${needle}".`, chain: [] };
    }
    if (match.status === 'superseded' && match.superseded_by) {
        const repl = adrs.find((a) => a.id === match.superseded_by);
        const chain = [match.id, match.superseded_by];
        return {
            answer: `${match.id} (${match.title}) superseded by ${match.superseded_by}${repl ? `: ${repl.title}` : ''}`,
            adr: match,
            chain,
        };
    }
    if (match.status === 'rejected' || match.status === 'deprecated') {
        return {
            answer: `${match.id} was ${match.status}: ${match.reason}`,
            adr: match,
            chain: [match.id],
        };
    }
    return {
        answer: `${match.id} (${match.status}): ${match.title} — ${match.reason}`,
        adr: match,
        chain: [match.id],
    };
}
function formatLifecycleStatus(status) {
    const idx = LIFECYCLE_ORDER.indexOf(status);
    return idx >= 0 ? LIFECYCLE_ORDER[idx] : status;
}
