import { renderCognitiveModeSelectorLines } from './cognitiveModePanel.js';
import { DASHBOARD_TITLE_V4, renderDecisionTraceLines, renderGovernanceRawLines, renderGovernanceSummaryLines, renderScopeMapLines, } from './governancePanel.js';
import { renderKeyHintLines } from './keyHints.js';
import { monitoringBadge, animatedSectionHeader } from './statusAnimation.js';
import { projectLabel, lastChangedFile, renderBox, sectionDivider, truncate, } from './uiHelpers.js';
function colors(enabled) {
    const wrap = (code) => (text) => enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
    return { bold: wrap('1'), dim: wrap('2'), green: wrap('32') };
}
/** Simplified compact view — Governance Decision Dashboard (V4). */
export function renderCompactView(state, ctx) {
    const c = colors(ctx.useColor);
    const w = ctx.width;
    const project = projectLabel(state.workspaceRoot);
    const agent = (state.status.lastWriter ?? 'runtime').toUpperCase();
    const task = state.status.currentTask?.trim() || '(idle)';
    const lastFile = lastChangedFile(state);
    const injectionPending = state.handoffInjection?.status === 'pending';
    const modeActive = ctx.cognitiveModeActive ?? 'A';
    const tick = ctx.tickCount ?? 0;
    const gov = state.governance;
    const header = `${c.bold(DASHBOARD_TITLE_V4)}${monitoringBadge(tick, ctx.live === true, c)}`;
    const section = (title) => animatedSectionHeader(title, tick, c);
    const inner = [
        truncate(header, w - 4),
        sectionDivider(w),
        truncate(`Project : ${project}`, w - 4),
        truncate(`Agent   : ${agent}`, w - 4),
        sectionDivider(w),
        section('Governance Summary'),
        sectionDivider(w),
        ...renderGovernanceSummaryLines(gov, ctx.useColor, w - 4),
        sectionDivider(w),
        section('Scope Map'),
        sectionDivider(w),
        ...renderScopeMapLines(gov, ctx.useColor, w - 4),
        sectionDivider(w),
        section('Decision Trace'),
        sectionDivider(w),
        ...renderDecisionTraceLines(gov, ctx.useColor, w - 4),
        sectionDivider(w),
        section('View Mode'),
        ...renderCognitiveModeSelectorLines({
            selection: ctx.cognitiveModeSelection ?? 'A',
            active: modeActive,
            useColor: ctx.useColor,
            width: w - 4,
            tick,
        }),
        ...(modeActive === 'B'
            ? [
                sectionDivider(w),
                section('Governance View'),
                sectionDivider(w),
                ...renderGovernanceRawLines(gov, ctx.useColor, w - 4),
            ]
            : []),
        sectionDivider(w),
        section('Current Task'),
        truncate(task, w - 4),
        'Last File:',
        truncate(lastFile, w - 4),
        sectionDivider(w),
        ...renderKeyHintLines({
            injectionPending,
            useColor: ctx.useColor,
            width: w - 4,
            view: 'compact',
            hasGovernanceReview: Boolean(gov?.review),
        }),
    ];
    return renderBox(inner, w);
}
