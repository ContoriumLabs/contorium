import { STATUS_FRAMES, statusGlyph } from './statusAnimation.js';
import { progressBar, truncate } from './uiHelpers.js';
function colors(useColor) {
    const wrap = (code) => (text) => useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
    return { bold: wrap('1'), dim: wrap('2'), green: wrap('32'), cyan: wrap('36'), yellow: wrap('33') };
}
export function modeStatusLamp(active, c, tick = 0) {
    if (active === 'B') {
        return `${statusGlyph(tick, c.green, true)} Overlay Active`;
    }
    const pulse = STATUS_FRAMES[tick % STATUS_FRAMES.length];
    return `${c.dim(pulse)} Observation`;
}
export function renderCognitiveModeSelectorLines(args) {
    const c = colors(args.useColor);
    const tick = args.tick ?? 0;
    const mark = (mode) => (args.selection === mode ? c.bold('❯') : ' ');
    if (args.compact) {
        const lamp = modeStatusLamp(args.active, c, tick);
        const a = args.selection === 'A' ? c.bold('A') : c.dim('A');
        const b = args.selection === 'B' ? c.bold('B') : c.dim('B');
        return [
            lamp,
            truncate(`${mark('A')}${a} Runtime   ${mark('B')}${b} Overlay`, args.width),
        ];
    }
    const lines = [modeStatusLamp(args.active, c, tick), ''];
    const row = (mode, title, subtitle) => {
        const titleStyled = args.selection === mode ? c.bold(title) : c.dim(title);
        lines.push(truncate(`${mark(mode)} ${mode}  ${titleStyled}`, args.width));
        lines.push(truncate(`   ${c.dim(subtitle)}`, args.width));
    };
    row('A', 'Runtime', 'Project · Task · Change feed');
    lines.push('');
    row('B', 'Cognitive Overlay', 'Skills · Presets · Insights');
    return lines;
}
export function renderCognitiveInsightsLines(insights, modeActive, useColor, width) {
    const c = colors(useColor);
    if (modeActive === 'A') {
        return [
            c.dim('Not available in Runtime mode'),
            '',
            c.dim('Switch to Overlay (B) for:'),
            c.dim('  · Intent analysis'),
            c.dim('  · Skill suggestions'),
            c.dim('  · Model presets'),
        ];
    }
    if (!insights?.detected_intent) {
        return [
            c.dim('Analyzing workspace…'),
            c.dim('Save a file or wait for sync'),
        ];
    }
    const intent = insights.detected_intent.intent;
    const conf = Math.round((insights.detected_intent.confidence ?? 0) * 100);
    const skill = insights.suggested_skills?.[0]?.name;
    const preset = insights.suggested_models?.[0]?.mode;
    return [
        truncate(`Intent : ${intent}`, width),
        '',
        truncate('Suggested Skill', width),
        skill ? truncate(`→ ${skill}`, width) : c.dim('→ (none)'),
        '',
        truncate('Preset', width),
        preset ? truncate(`→ ${preset}`, width) : c.dim('→ (none)'),
        '',
        truncate('Confidence', width),
        truncate(`${progressBar(conf / 100)} ${conf}%`, width),
    ];
}
