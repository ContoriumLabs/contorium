import { truncate } from './uiHelpers.js';
function colors(useColor) {
    const wrap = (code) => (text) => useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
    return { bold: wrap('1'), dim: wrap('2'), green: wrap('32'), yellow: wrap('33'), red: wrap('31'), cyan: wrap('36') };
}
function decisionStyled(action, c) {
    const up = action.toUpperCase();
    if (up === 'BLOCK') {
        return c.red(up);
    }
    if (up === 'WARN' || up === 'INJECT_FIX') {
        return c.yellow(up);
    }
    if (up === 'ALLOW') {
        return c.green(up);
    }
    return up;
}
function riskScoreLabel(score) {
    if (score <= 0) {
        return '—';
    }
    return (score / 100).toFixed(2);
}
/** Governance Summary — replaces low-dim Health/Velocity block in compact. */
export function renderGovernanceSummaryLines(gov, useColor, width) {
    const c = colors(useColor);
    if (!gov?.review) {
        return [
            c.dim('No decision snapshot — run: contorium decision derive'),
            truncate(`Risk Score : —`, width),
            truncate(`Decision   : —`, width),
        ];
    }
    const r = gov.review;
    return [
        truncate(`Risk Score     : ${riskScoreLabel(gov.risk_score)} (${r.risk.toUpperCase()})`, width),
        truncate(`Decision       : ${decisionStyled(gov.decision_action, c)}`, width),
        truncate(`Mode           : ${gov.mode_label}`, width),
        truncate(`Rule Count      : ${gov.rule_count}`, width),
        truncate(`Files Affected : ${gov.files_affected}`, width),
        truncate(`Source         : ${r.review_source}`, width),
    ];
}
/** Decision Feed — governance-flavored event lines. */
export function renderDecisionFeedLines(state, gov, useColor, width) {
    const c = colors(useColor);
    const lines = [];
    if (gov?.review) {
        const r = gov.review;
        const tag = decisionStyled(gov.decision_action, c);
        lines.push(truncate(`[${tag}] ${r.file}`, width));
        lines.push(truncate(` ↳ rule: ${r.change_type} / ${r.impact}`, width));
        lines.push(truncate(` ↳ decision: ${r.recommendation.replace(/_/g, ' ')}`, width));
        lines.push(truncate(` ↳ risk: ${riskScoreLabel(gov.risk_score)}`, width));
    }
    for (const ev of state.recentEvents.slice(0, 3)) {
        const file = ev.file?.replace(/\\/g, '/').split('/').pop() ?? ev.detail ?? '';
        lines.push(truncate(`${c.dim('[INFO]')} ${ev.type} ${file}`, width));
    }
    return lines.length ? lines.slice(0, 8) : [c.dim('(no decisions yet)')];
}
export function renderScopeMapLines(gov, useColor, width) {
    const c = colors(useColor);
    if (!gov) {
        return [c.dim('(scope pending)')];
    }
    const s = gov.scope;
    const row = (label, files) => {
        if (!files.length) {
            return truncate(`${label}: —`, width);
        }
        const head = files.slice(0, 2).join(', ');
        const more = files.length > 2 ? ` (+${files.length - 2})` : '';
        return truncate(`${label}: ${head}${more}`, width);
    };
    return [
        row('Primary', s.primary_files),
        row('Related', s.related_files),
        row('Risk', s.risk_files),
        row('Dependency', s.dependency_files),
    ];
}
export function renderDecisionTraceLines(gov, useColor, width) {
    const c = colors(useColor);
    if (!gov?.review) {
        return [c.dim('Run decision derive to populate provenance timeline')];
    }
    const r = gov.review;
    const steps = [
        'diff / review ingested',
        `scope → ${gov.files_affected} file(s)`,
        `rules → ${gov.rule_count} reason(s)`,
        `risk engine → ${riskScoreLabel(gov.risk_score)}`,
        `decision → ${gov.decision_action.toUpperCase()}`,
        r.recommendation.includes('inject') || gov.decision_action === 'inject_fix'
            ? 'inject payload → YES'
            : 'inject payload → optional',
    ];
    return steps.map((s, i) => truncate(`${i + 1}. ${s}`, width));
}
/** Mode B — governance RAW view (replaces cognitive insights in B). */
export function renderGovernanceRawLines(gov, useColor, width) {
    const c = colors(useColor);
    if (!gov?.review) {
        return [c.dim('Provenance not derived'), c.dim('CLI: contorium decision derive')];
    }
    const r = gov.review;
    const lines = [
        truncate(`violations: ${gov.rule_count}`, width),
        truncate(`decision: ${gov.decision_action}`, width),
        truncate(`risk: ${r.risk} · impact: ${r.impact}`, width),
        '',
        truncate('why_chain:', width),
    ];
    for (const line of r.reason_chain.slice(0, 5)) {
        lines.push(truncate(` · ${line}`, width));
    }
    if (r.reason_chain.length > 5) {
        lines.push(c.dim(` · +${r.reason_chain.length - 5} more`));
    }
    return lines;
}
/** @deprecated use COGNITIVE_DASHBOARD_TITLE from cognitiveRenderer */
export const DASHBOARD_TITLE_V4 = 'CONTORIUM • Cognitive State';
