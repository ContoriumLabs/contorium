"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDecisionContradictions = detectDecisionContradictions;
function titleTokens(title) {
    return new Set(title
        .toLowerCase()
        .split(/[^\w]+/)
        .filter((t) => t.length > 3));
}
function tokenOverlap(a, b) {
    let n = 0;
    for (const t of a) {
        if (b.has(t)) {
            n += 1;
        }
    }
    return n;
}
const OPPOSING = [
    ['first', 'primary', 'cursor'],
    ['mcp', 'move', 'switch', 'migrate', 'replace'],
];
function hasOpposingDirection(a, b) {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    for (const group of OPPOSING) {
        const aHit = group.some((w) => la.includes(w));
        const bHit = group.some((w) => lb.includes(w));
        if (aHit && bHit) {
            continue;
        }
        const aOther = OPPOSING.find((g) => g !== group)?.some((w) => la.includes(w));
        const bOther = OPPOSING.find((g) => g !== group)?.some((w) => lb.includes(w));
        if (aHit && bOther) {
            return true;
        }
        if (bHit && aOther) {
            return true;
        }
    }
    if ((la.includes('use') && lb.includes('avoid')) ||
        (la.includes('adopt') && lb.includes('deprecate')) ||
        (la.includes('first') && lb.includes('move to'))) {
        return true;
    }
    return false;
}
/** Detect cognitive conflicts between accepted/proposed ADRs (not just DAG edges). */
function detectDecisionContradictions(adrs) {
    const active = adrs.filter((a) => a.status === 'accepted' || a.status === 'proposed');
    const out = [];
    const seen = new Set();
    for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
            const a = active[i];
            const b = active[j];
            if (a.superseded_by === b.id || b.superseded_by === a.id) {
                continue;
            }
            const overlap = tokenOverlap(titleTokens(a.title), titleTokens(b.title));
            const textOverlap = overlap >= 1 ||
                titleTokens(a.reason).size > 0 &&
                    tokenOverlap(titleTokens(a.reason), titleTokens(b.reason)) >= 2;
            const opposing = hasOpposingDirection(a.title, b.title) ||
                hasOpposingDirection(a.reason, b.reason);
            if ((overlap >= 2 || textOverlap) && opposing) {
                const key = [a.id, b.id].sort().join('|');
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                out.push({
                    decision: a.id,
                    decision_title: a.title,
                    status: 'contradicted',
                    by: b.id,
                    by_title: b.title,
                    reason: `Conflicting direction: "${a.title}" vs "${b.title}"`,
                });
            }
        }
    }
    return out;
}
