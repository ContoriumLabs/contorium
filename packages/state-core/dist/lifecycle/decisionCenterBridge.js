"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendLifecycleTrustOverlay = appendLifecycleTrustOverlay;
exports.formatSupersededDecisionPreamble = formatSupersededDecisionPreamble;
/** Append lifecycle trust overlay to Decision Center formatted output. */
function appendLifecycleTrustOverlay(formatted, index) {
    if (!index?.decisions.length) {
        return formatted;
    }
    const lines = [
        ...formatted,
        '',
        '---',
        'Knowledge Lifecycle',
        `Knowledge Health: ${index.health.score}% | Review queue: ${index.review_queue.length}`,
        '',
    ];
    const flagged = index.decisions.filter((r) => r.needs_review || r.formatted_warnings.length || r.lifecycle_status !== 'ACTIVE');
    const show = (flagged.length ? flagged : index.decisions).slice(0, 10);
    for (const r of show) {
        const marker = r.needs_review || r.conflict_refs.length ? '!' : '-';
        lines.push(`${marker} ${r.title}`, `  Status ${r.lifecycle_status} | Trust ${r.confidence.overall}% | Freshness ${r.freshness_score}%`);
        for (const w of r.formatted_warnings.slice(0, 2)) {
            lines.push(`  ${w}`);
        }
        if (r.evolution_chain.length > 1) {
            lines.push(`  Evolution: ${r.evolution_chain.join(' -> ')}`);
        }
        lines.push('');
    }
    if (index.review_queue.length) {
        lines.push(`Ask "What needs review?" or run \`contorium review\` for ${index.review_queue.length} queued item(s).`);
    }
    return lines;
}
/** Short superseded preamble for Ask decision answers. */
function formatSupersededDecisionPreamble(record) {
    if (record.lifecycle_status !== 'SUPERSEDED' && !record.superseded_by) {
        return undefined;
    }
    const until = record.created_at?.slice(0, 10) ?? 'unknown date';
    const successor = record.superseded_by ? ` Superseded by \`${record.superseded_by}\`.` : '';
    const chain = record.evolution_chain.length > 1
        ? ` Evolution: ${record.evolution_chain.join(' -> ')}.`
        : '';
    return `**${record.title}** was an earlier project decision (recorded ${until}).${successor}${chain}`;
}
