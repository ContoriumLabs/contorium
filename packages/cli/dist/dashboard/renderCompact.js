import { renderCognitiveInsightsLines, renderCognitiveModeSelectorLines } from './cognitiveModePanel.js';
import { renderKeyHintLines } from './keyHints.js';
import { animatedSectionHeader, monitoringBadge } from './statusAnimation.js';
import { projectLabel, projectMetrics, lastChangedFile, progressBar, renderBox, sectionDivider, truncate, } from './uiHelpers.js';
function colors(enabled) {
    const wrap = (code) => (text) => enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
    return {
        bold: wrap('1'),
        dim: wrap('2'),
        green: wrap('32'),
        yellow: wrap('33'),
        red: wrap('31'),
        cyan: wrap('36'),
    };
}
function riskStyled(risk, level, c) {
    if (level === 'high') {
        return c.red(risk);
    }
    if (level === 'medium') {
        return c.yellow(risk);
    }
    return c.green(risk);
}
/** Simplified compact view — default passive (long-term terminal attach). */
export function renderCompactView(state, ctx) {
    const c = colors(ctx.useColor);
    const w = ctx.width;
    const metrics = projectMetrics(state);
    const project = projectLabel(state.workspaceRoot);
    const agent = (state.status.lastWriter ?? 'runtime').toUpperCase();
    const task = state.status.currentTask?.trim() || '(idle)';
    const lastFile = lastChangedFile(state);
    const injectionPending = state.handoffInjection?.status === 'pending';
    const modeActive = ctx.cognitiveModeActive ?? 'A';
    const tick = ctx.tickCount ?? 0;
    const header = `${c.bold('CONTORIUM • Runtime Cognitive Cortex')}${monitoringBadge(tick, ctx.live === true, c)}`;
    const section = (title) => animatedSectionHeader(title, tick, c);
    const inner = [
        truncate(header, w - 4),
        sectionDivider(w),
        section('Project'),
        sectionDivider(w),
        truncate(`Project : ${project}`, w - 4),
        truncate(`Agent   : ${agent}`, w - 4),
        truncate(`Health  : ${metrics.health}`, w - 4),
        truncate(`Risk    : ${riskStyled(metrics.risk, metrics.riskLevel, c)}`, w - 4),
        truncate(`Changes : ${metrics.fileCount} files`, w - 4),
        'Velocity',
        truncate(`${progressBar(metrics.velocityRatio)} ${metrics.velocity}`, w - 4),
        sectionDivider(w),
        section('Cognitive Mode'),
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
                section('Cognitive Insights'),
                sectionDivider(w),
                ...renderCognitiveInsightsLines(ctx.cognitiveInsights, modeActive, ctx.useColor, w - 4),
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
        }),
    ];
    return renderBox(inner, w);
}
