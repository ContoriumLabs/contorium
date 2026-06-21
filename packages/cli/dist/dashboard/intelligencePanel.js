import { truncate } from './uiHelpers.js';
function colors(useColor) {
    const wrap = (code) => (text) => useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
    return { bold: wrap('1'), dim: wrap('2'), green: wrap('32'), yellow: wrap('33'), cyan: wrap('36') };
}
function pct(n) {
    return `${Math.round(n * 100)}%`;
}
/** v1.2+ — Intelligence Health & Coverage metrics */
export function renderIntelligenceHealthLines(health, useColor, width) {
    const c = colors(useColor);
    if (!health?.metrics) {
        return [c.dim('Run sync to derive intelligence health')];
    }
    const m = health.metrics;
    const scorePct = Math.round(m.health_score * 100);
    return [
        truncate(`${c.bold('Score')} : ${scorePct}% · ${m.health_category}`, width),
        truncate(`Completeness : ${pct(m.intelligence_completeness)}`, width),
        truncate(`Decision Cov : ${pct(m.decision_coverage)}`, width),
        truncate(`Intent Link  : ${pct(m.intent_linkage)}`, width),
        truncate(`Provenance   : ${pct(m.provenance_coverage)}`, width),
    ];
}
/** v1.2+ — Knowledge Coverage panel */
export function renderKnowledgeCoverageLines(health, useColor, width) {
    const c = colors(useColor);
    if (!health?.metrics) {
        return [c.dim('Run sync to derive coverage')];
    }
    const m = health.metrics;
    const detail = health.coverage_detail;
    const lines = [truncate(`${c.bold('Coverage')} : ${pct(m.knowledge_coverage)}`, width)];
    if (detail?.total_modules.length) {
        lines.push(truncate(`${detail.covered_modules.length}/${detail.total_modules.length} modules covered`, width));
        const sample = detail.covered_modules.slice(0, 3).join(', ');
        if (sample) {
            lines.push(truncate(c.green(`✓ ${sample}`), width));
        }
        const uncovered = detail.total_modules.filter((m) => !detail.covered_modules.includes(m)).slice(0, 2);
        if (uncovered.length) {
            lines.push(truncate(c.dim(`… ${uncovered.join(', ')}`), width));
        }
    }
    return lines;
}
/** v1.1.3 — Timeline visualization (recent events) */
export function renderTimelineVizLines(timeline, useColor, width) {
    const c = colors(useColor);
    const events = [...(timeline?.events ?? [])].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    if (!events.length) {
        return [c.dim('(no evolution timeline yet)')];
    }
    return events.map((e) => {
        const date = new Date(e.timestamp).toISOString().slice(0, 10);
        return truncate(`${c.cyan('●')} ${date} ${e.event_type} ${e.entity_id}`, width);
    });
}
/** v1.1.3 — Evolution graph chains */
export function renderEvolutionVizLines(graph, useColor, width) {
    const c = colors(useColor);
    const chain = graph?.chains[0];
    if (!chain?.nodes.length) {
        return [c.dim('(no evolution chains yet)')];
    }
    const path = chain.nodes.map((n) => n.label).join(' → ');
    return [
        truncate(`${c.bold(chain.topic)}`, width),
        truncate(path, width),
        ...(graph.chains.length > 1
            ? [c.dim(`+${graph.chains.length - 1} more chain(s)`)]
            : []),
    ];
}
/** v1.1.3 — Provenance explorer */
export function renderProvenanceExplorerLines(provenance, useColor, width) {
    const c = colors(useColor);
    const entry = provenance?.entries[0];
    if (!entry?.chain.length) {
        return [c.dim('(no provenance chains yet)')];
    }
    const lines = [truncate(`${c.bold(entry.query_anchor)}`, width)];
    for (const link of entry.chain.slice(0, 4)) {
        lines.push(truncate(` ${link.layer.toUpperCase()} → ${link.label}`, width));
    }
    if (provenance.entries.length > 1) {
        lines.push(c.dim(`+${provenance.entries.length - 1} trace(s)`));
    }
    return lines;
}
/** v1.1.3 — Impact visualization */
export function renderImpactVizLines(impact, useColor, width) {
    const c = colors(useColor);
    const entry = impact?.entries[impact.entries.length - 1];
    if (!entry) {
        return [c.dim('(no impact graph yet)')];
    }
    const radius = entry.impact_radius ?? entry.blast_radius ?? 0;
    const lines = [
        truncate(`Source : ${entry.source_entity}`, width),
        truncate(`Radius : ${radius} · Depth : ${entry.dependency_depth ?? '—'}`, width),
    ];
    for (const node of entry.impacted_nodes.slice(0, 3)) {
        lines.push(truncate(` · ${node.module} (${node.impact_level})`, width));
    }
    if (entry.impacted_nodes.length > 3) {
        lines.push(c.dim(` +${entry.impacted_nodes.length - 3} nodes`));
    }
    return lines;
}
