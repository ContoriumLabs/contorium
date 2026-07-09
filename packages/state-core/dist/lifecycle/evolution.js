"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDecisionEvolutionChain = buildDecisionEvolutionChain;
exports.buildSupersededContext = buildSupersededContext;
exports.mapAdrToLifecycleStatus = mapAdrToLifecycleStatus;
/** Walk superseded_by chain into an evolution timeline (oldest -> newest). */
function buildDecisionEvolutionChain(adrs, startId) {
    const byId = new Map(adrs.map((a) => [a.id, a]));
    const chain = [];
    const seen = new Set();
    let current = byId.get(startId);
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        chain.unshift(current.id);
        const predecessor = adrs.find((a) => a.superseded_by === current.id);
        current = predecessor;
    }
    let forward = byId.get(startId);
    while (forward?.superseded_by && !seen.has(forward.superseded_by)) {
        const next = byId.get(forward.superseded_by);
        if (!next) {
            break;
        }
        seen.add(next.id);
        chain.push(next.id);
        forward = next;
    }
    return chain;
}
/** Build superseded context for validity layer (优化.md §三.5). */
function buildSupersededContext(adr, adrs) {
    if (adr.status !== 'superseded') {
        return undefined;
    }
    const replacement = adr.superseded_by
        ? adrs.find((a) => a.id === adr.superseded_by)
        : undefined;
    return {
        replacement: adr.superseded_by,
        reason: replacement
            ? `Superseded by ${replacement.title}`
            : adr.superseded_by
                ? 'Replaced by a newer decision'
                : 'Architecture or policy evolution',
    };
}
function mapAdrToLifecycleStatus(status) {
    switch (status) {
        case 'accepted':
        case 'implemented':
        case 'proposed':
            return 'ACTIVE';
        case 'superseded':
            return 'SUPERSEDED';
        case 'deprecated':
        case 'rejected':
            return 'DEPRECATED';
        default:
            return 'UNKNOWN';
    }
}
