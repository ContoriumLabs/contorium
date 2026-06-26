import { renderDecisionTraceLines, renderGovernanceRawLines, } from './governancePanel.js';
import { renderEvolutionVizLines, renderProvenanceExplorerLines, } from './intelligencePanel.js';
import { liveModuleMarker, liveModuleTitle, monitoringBadge } from './statusAnimation.js';
import { renderKeyHintFooter } from './keyHints.js';
import { renderHistoryStreams } from './historyPanel.js';
import { renderLlmConfigStreams } from './aiConfigPanel.js';
import { padVisible, projectLabel, projectMetrics, truncate, } from './uiHelpers.js';
export const COGNITIVE_DASHBOARD_TITLE = 'CONTORIUM • Cognitive State';
function colors(useColor) {
    const wrap = (code) => (text) => useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
    return {
        bold: wrap('1'),
        dim: wrap('2'),
        green: wrap('32'),
        yellow: wrap('33'),
        red: wrap('31'),
        cyan: wrap('36'),
    };
}
export function viewLensFromSelection(sel) {
    if (sel === 'B') {
        return 'governance';
    }
    if (sel === 'C') {
        return 'debug';
    }
    if (sel === 'D') {
        return 'history';
    }
    if (sel === 'E') {
        return 'llm';
    }
    return 'live';
}
function confidenceScore(state) {
    const pil = state.intelligenceHealth?.metrics?.health_score;
    if (pil != null && Number.isFinite(pil)) {
        return pil.toFixed(2);
    }
    const gov = state.governance?.risk_score;
    if (gov != null && gov > 0) {
        return (1 - gov / 100).toFixed(2);
    }
    return '—';
}
function stageLabel(state) {
    const stage = state.handoff?.goal?.trim();
    if (stage) {
        return truncate(stage.split(/[.!?]/)[0] ?? stage, 24);
    }
    const m = projectMetrics(state);
    if (m.fileCount >= 2) {
        return 'execution';
    }
    return state.status.currentTask?.trim() ? 'focus' : 'idle';
}
/** LEVEL 1 — Cognitive Core (single source of truth header). */
export function renderCognitiveCore(state, ctx) {
    const c = colors(ctx.useColor);
    const w = ctx.width;
    const tick = ctx.tickCount ?? 0;
    const project = projectLabel(state.workspaceRoot);
    const agent = (state.status.lastWriter ?? 'runtime').toUpperCase();
    const focus = state.status.currentTask?.trim() || '(idle)';
    const conf = confidenceScore(state);
    const stage = stageLabel(state);
    const title = `${c.bold(COGNITIVE_DASHBOARD_TITLE)}${monitoringBadge(tick, ctx.live === true, c)}`;
    return [
        truncate(title, w),
        truncate(`${c.dim('Project:')} ${project}  ${c.dim('|')}  ${c.dim('Agent:')} ${agent}  ${c.dim('|')}  ${c.dim('Stage:')} ${stage}`, w),
        truncate(`${c.dim('Focus:')} ${focus}  ${c.dim('|')}  ${c.dim('Confidence:')} ${conf}`, w),
    ];
}
function buildDimensions(state, gov, c, cellW) {
    const fileCount = state.change?.changed_files?.length ?? 0;
    const task = state.status.currentTask?.trim() || '—';
    const goal = gov?.review?.recommendation?.replace(/_/g, ' ') ??
        state.handoff?.goal?.trim() ??
        state.handoff?.summary?.slice(0, 80) ??
        '—';
    const decision = gov?.decision_action
        ? gov.decision_action.replace(/_/g, ' ')
        : gov?.review
            ? 'pending review'
            : 'pending derive';
    const why = gov?.review?.reason_chain?.[0] ??
        (state.handoff?.impact_summary?.risk
            ? `risk level: ${state.handoff.impact_summary.risk}`
            : 'not enough evidence yet');
    const stateLines = [
        truncate(task, cellW - 2),
        truncate(`modified files: ${fileCount}`, cellW - 2),
        truncate(`events: ${state.status.eventCount}`, cellW - 2),
    ];
    const intentLines = [
        truncate(goal, cellW - 2),
        truncate(state.handoff?.summary?.slice(0, cellW - 2) ?? 'awaiting project sync', cellW - 2),
    ];
    const decisionLines = [
        truncate(decision, cellW - 2),
        gov?.review
            ? truncate(`${gov.review.risk} · ${gov.review.change_type}`, cellW - 2)
            : c.dim('run: contorium decision derive'),
    ];
    const whyLines = [
        truncate(why, cellW - 2),
        ...(gov?.review?.reason_chain?.slice(1, 3).map((l) => truncate(l, cellW - 2)) ?? []),
    ];
    return [
        { title: 'STATE', lines: stateLines },
        { title: 'INTENT', lines: intentLines },
        { title: 'DECISION', lines: decisionLines },
        { title: 'WHY', lines: whyLines },
    ];
}
function renderDimensionRow(left, right, c, colW, tick, leftLive, rightLive) {
    const leftTitle = `${liveModuleMarker(tick, leftLive, c)} ${c.bold(left.title)}`;
    const rightTitle = `${liveModuleMarker(tick, rightLive, c)} ${c.bold(right.title)}`;
    const titleRow = `${padVisible(leftTitle, colW)}│ ${rightTitle}`;
    const maxBody = Math.max(left.lines.length, right.lines.length, 1);
    const bodyRows = [];
    for (let i = 0; i < maxBody; i++) {
        const l = padVisible(left.lines[i] ?? '', colW);
        const r = right.lines[i] ?? '';
        bodyRows.push(`${l} │ ${r}`);
    }
    return [titleRow, ...bodyRows];
}
/** LEVEL 2 — STATE / INTENT / DECISION / WHY grid. */
export function renderCognitiveDimensions(state, gov, ctx) {
    const c = colors(ctx.useColor);
    const tick = ctx.tickCount ?? 0;
    const inner = Math.max(40, ctx.width - 4);
    const colW = Math.floor((inner - 3) / 2);
    const [stateCell, intentCell, decisionCell, whyCell] = buildDimensions(state, gov, c, colW);
    const stateLive = ctx.live === true || state.recentEvents.length > 0 || (state.change?.changed_files?.length ?? 0) > 0;
    const intentLive = Boolean(state.handoff?.goal?.trim() || state.handoff?.summary?.trim());
    const decisionLive = Boolean(gov?.review || gov?.decision_action);
    const whyLive = Boolean(gov?.review?.reason_chain?.length);
    const sep = `${'─'.repeat(colW)}┼${'─'.repeat(Math.max(0, inner - colW - 1))}`;
    const top = renderDimensionRow(stateCell, intentCell, c, colW, tick, stateLive, intentLive);
    const bottom = renderDimensionRow(decisionCell, whyCell, c, colW, tick, decisionLive, whyLive);
    return [...top, sep, ...bottom];
}
function changeStreamLines(state, c, width) {
    const lines = [];
    const fileCount = state.change?.changed_files?.length ?? 0;
    if (fileCount) {
        lines.push(truncate(`git_change: modified ${fileCount} file(s)`, width));
    }
    if (state.status.currentTask?.trim()) {
        lines.push(truncate(`task_update: ${state.status.currentTask.trim()}`, width));
    }
    if (state.governance?.decision_action && state.governance.decision_action !== 'allow') {
        lines.push(truncate(`decision: ${state.governance.decision_action.replace(/_/g, ' ')}`, width));
    }
    else if (!state.governance?.review) {
        lines.push(c.dim('decision: pending derive'));
    }
    for (const ev of state.recentEvents.slice(0, 4)) {
        const file = ev.file?.replace(/\\/g, '/').split('/').pop() ?? ev.detail ?? '';
        lines.push(truncate(`${ev.type}${file ? `: ${file}` : ''}`, width));
    }
    return lines.length ? lines.slice(0, 6) : [c.dim('(no cognitive events yet)')];
}
function healthStreamLines(state, gov, c, width) {
    const m = projectMetrics(state);
    const risk = gov?.risk_score ? (gov.risk_score / 100).toFixed(2) : m.riskLevel === 'high' ? '0.72' : m.riskLevel === 'medium' ? '0.45' : '0.32';
    const conf = confidenceScore(state);
    const stability = m.velocity === 'HIGH' ? 'low' : m.velocity === 'MEDIUM' ? 'medium' : 'high';
    const drift = m.fileCount >= 5 ? 'medium' : 'low';
    const pil = state.intelligenceHealth?.metrics;
    return [
        truncate(`Risk: ${risk}  |  Confidence: ${conf}`, width),
        truncate(`Stability: ${stability}  |  Drift: ${drift}`, width),
        pil
            ? truncate(`Health: ${Math.round(pil.health_score * 100)}% ${pil.health_category}`, width)
            : c.dim('Health: awaiting sync'),
    ];
}
function evolutionStreamLines(state, c, width) {
    const evo = renderEvolutionVizLines(state.evolutionGraph, false, width);
    if (evo.length && !evo[0].includes('no evolution')) {
        return evo.map((l) => (l.startsWith('(') ? c.dim(l) : truncate(`→ ${l.replace(/\x1b\[[0-9;]*m/g, '')}`, width)));
    }
    const timeline = [...(state.evolutionTimeline?.events ?? [])]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-4);
    if (timeline.length) {
        return timeline.map((e, i) => truncate(`→ v${i + 1} (${e.event_type}: ${e.entity_id})`, width));
    }
    const prov = renderProvenanceExplorerLines(state.provenanceChain, false, width);
    if (prov.length && !prov[0].includes('no provenance')) {
        return prov.slice(0, 4);
    }
    return [c.dim('→ awaiting evolution artifacts')];
}
function streamBlock(title, body, c, width, tick, live) {
    return [
        liveModuleTitle(title, tick, live, c, width),
        ...body.map((l) => truncate(`  ${l}`, width)),
        '',
    ];
}
/** LEVEL 3 — Change / Health / Evolution streams (live lens). */
export function renderCognitiveStreams(state, gov, ctx) {
    const c = colors(ctx.useColor);
    const w = ctx.width;
    const tick = ctx.tickCount ?? 0;
    const changeLive = ctx.live === true ||
        state.recentEvents.length > 0 ||
        (state.change?.changed_files?.length ?? 0) > 0;
    const healthLive = ctx.live === true || Boolean(state.intelligenceHealth?.metrics);
    const evolutionLive = ctx.live === true ||
        Boolean(state.evolutionGraph?.chains.length || state.evolutionTimeline?.events.length);
    return [
        liveModuleTitle('Cognitive Streams', tick, ctx.live === true, c, w),
        truncate('─'.repeat(Math.max(16, w - 4)), w),
        ...streamBlock('Change Stream', changeStreamLines(state, c, w - 2), c, w, tick, changeLive),
        ...streamBlock('Cognitive Health', healthStreamLines(state, gov, c, w - 2), c, w, tick, healthLive),
        ...streamBlock('Evolution', evolutionStreamLines(state, c, w - 2), c, w, tick, evolutionLive),
    ];
}
/** Governance overlay lens — replaces stream body. */
export function renderGovernanceOverlayStreams(state, gov, ctx) {
    const c = colors(ctx.useColor);
    const w = ctx.width;
    const tick = ctx.tickCount ?? 0;
    const raw = renderGovernanceRawLines(gov, ctx.useColor, w - 2);
    const scope = gov?.scope;
    const scopeLines = scope
        ? [
            truncate(`Primary: ${scope.primary_files.slice(0, 2).join(', ') || '—'}`, w - 2),
            truncate(`Risk files: ${scope.risk_files.slice(0, 2).join(', ') || '—'}`, w - 2),
        ]
        : [c.dim('(scope pending)')];
    const govLive = ctx.live === true || Boolean(gov?.review);
    return [
        liveModuleTitle('Governance Overlay', tick, govLive, c, w),
        truncate('─'.repeat(Math.max(16, w - 4)), w),
        ...streamBlock('Policy Snapshot', scopeLines, c, w, tick, Boolean(scope)),
        ...streamBlock('Violations & Decision', raw, c, w, tick, govLive),
    ];
}
/** Debug trace lens — decision provenance + raw trace. */
export function renderDebugTraceStreams(gov, ctx) {
    const c = colors(ctx.useColor);
    const w = ctx.width;
    const tick = ctx.tickCount ?? 0;
    const trace = renderDecisionTraceLines(gov, ctx.useColor, w - 2);
    const debugLive = ctx.live === true || Boolean(gov?.review);
    return [
        liveModuleTitle('Debug Trace', tick, debugLive, c, w),
        truncate('─'.repeat(Math.max(16, w - 4)), w),
        ...streamBlock('Decision Provenance', trace, c, w, tick, debugLive),
        ...streamBlock('Raw Review', renderGovernanceRawLines(gov, ctx.useColor, w - 2), c, w, tick, debugLive),
    ];
}
/** View Mode — cognitive perspective selector (not feature panels). */
export function renderCognitiveViewMode(ctx) {
    const c = colors(ctx.useColor);
    const w = ctx.width;
    const sel = ctx.cognitiveModeSelection ?? 'A';
    const active = ctx.cognitiveModeActive ?? 'A';
    const dot = (id, label) => {
        const on = sel === id;
        const applied = id !== 'C' && id !== 'D' && id !== 'E' && active === id;
        const marker = on ? c.bold('●') : c.dim('○');
        const text = on ? c.bold(label) : c.dim(label);
        const suffix = applied ? c.green(' ✓') : '';
        return truncate(`${marker} ${text}${suffix}`, w);
    };
    return [
        truncate(`${c.bold('View Mode')}`, w),
        dot('A', 'Live Cognition'),
        dot('B', 'Governance Overlay'),
        dot('C', 'Debug Trace'),
        dot('D', 'Project History'),
        dot('E', 'LLM Config'),
        c.dim('↑↓ view · Enter apply (A/B) · C/D/E preview · E: ←→ provider'),
    ];
}
/** Full dashboard — main panel (header → view mode), excludes shortcut footer. */
export function renderCognitiveMainPanel(state, ctx) {
    const gov = state.governance;
    const lens = viewLensFromSelection(ctx.cognitiveModeSelection);
    const inner = Math.max(40, ctx.width - 4);
    const core = renderCognitiveCore(state, ctx);
    const sep = `├${'─'.repeat(inner)}┤`;
    const dimensions = renderCognitiveDimensions(state, gov, { ...ctx, width: inner + 4 }).map((line) => `│ ${padVisible(line, inner)} │`);
    let streamLines;
    const streamCtx = { ...ctx, width: inner };
    if (lens === 'governance') {
        streamLines = renderGovernanceOverlayStreams(state, gov, streamCtx);
    }
    else if (lens === 'debug') {
        streamLines = renderDebugTraceStreams(gov, streamCtx);
    }
    else if (lens === 'history') {
        streamLines = renderHistoryStreams(ctx.cilHistoryLines, streamCtx);
    }
    else if (lens === 'llm') {
        streamLines = renderLlmConfigStreams({
            snapshot: ctx.llmSnapshot,
            step: ctx.llmStep ?? 'provider',
            providerSelection: ctx.llmProviderSelection ?? 'openai',
            keyInputBuffer: ctx.llmKeyInputBuffer ?? '',
            lastTest: ctx.llmLastTest,
            useColor: ctx.useColor,
            width: inner,
            tickCount: ctx.tickCount,
            live: ctx.live,
        });
    }
    else {
        streamLines = renderCognitiveStreams(state, gov, streamCtx);
    }
    const streams = streamLines.map((line) => `│ ${padVisible(line, inner)} │`);
    const viewMode = renderCognitiveViewMode(ctx).map((line) => `│ ${padVisible(line, inner)} │`);
    return [
        `┌${'─'.repeat(inner)}┐`,
        ...core.map((line) => `│ ${padVisible(line, inner)} │`),
        sep,
        ...dimensions,
        sep,
        ...streams,
        sep,
        ...viewMode,
    ];
}
/** Shortcut footer — always pinned to terminal bottom by layout helper. */
export function renderCognitiveShortcutFooter(state, ctx) {
    const inner = Math.max(40, ctx.width - 4);
    const injectionPending = state.handoffInjection?.status === 'pending';
    const footerSep = `├${'─'.repeat(inner)}┤`;
    const footerLines = renderKeyHintFooter({
        injectionPending,
        useColor: ctx.useColor,
        width: inner,
    }).map((line) => `│ ${padVisible(line, inner)} │`);
    return [footerSep, ...footerLines, `└${'─'.repeat(inner)}┘`];
}
/** @deprecated use renderCognitiveMainPanel + renderCognitiveShortcutFooter */
export function renderCognitiveDashboardBody(state, ctx) {
    return [...renderCognitiveMainPanel(state, ctx), ...renderCognitiveShortcutFooter(state, ctx)];
}
