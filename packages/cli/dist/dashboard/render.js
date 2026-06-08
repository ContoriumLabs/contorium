import { buildChpHandoffStateSync, formatChpCompact, formatUnderstandingMiniGraph } from '@contora/state-core';
function createColors(enabled) {
    const wrap = (code) => (text) => enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
    return {
        green: wrap('32'),
        blue: wrap('34'),
        red: wrap('31'),
        yellow: wrap('33'),
        cyan: wrap('36'),
        dim: wrap('2'),
        bold: wrap('1'),
    };
}
function truncate(text, max) {
    if (text.length <= max) {
        return text;
    }
    return `${text.slice(0, Math.max(0, max - 1))}…`;
}
function basenameOf(rel) {
    const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : rel;
}
function matchesFilter(symbol, filter) {
    if (!filter?.trim()) {
        return true;
    }
    return symbol.toLowerCase().includes(filter.trim().toLowerCase());
}
function changePrefix(changeType, c) {
    switch (changeType) {
        case 'added':
            return c.green('+');
        case 'modified':
            return c.yellow('~');
        case 'removed':
            return c.red('-');
        default:
            return c.dim('·');
    }
}
function formatFunctionChange(kc, c) {
    const prefix = changePrefix(kc.change_type, c);
    const sym = kc.kind === 'function' ? `${kc.symbol}()` : kc.symbol;
    return `${prefix} ${sym}`;
}
function keyChanges(state, filter) {
    const raw = state.handoff?.key_changes?.length
        ? state.handoff.key_changes
        : state.change?.key_changes ?? [];
    return raw.filter((k) => matchesFilter(k.symbol, filter));
}
function functionUpdateLines(state, c, width, filter) {
    const changes = keyChanges(state, filter)
        .filter((k) => k.kind === 'function' || k.kind === 'class')
        .slice(0, 8);
    if (changes.length) {
        return changes.map((kc) => truncate(formatFunctionChange(kc, c), width - 2));
    }
    const files = (state.change?.changed_files ?? [])
        .filter((f) => matchesFilter(basenameOf(f), filter))
        .slice(0, 6);
    if (files.length) {
        return files.map((f) => truncate(`${c.dim('~')} ${basenameOf(f)}`, width - 2));
    }
    return [c.dim(filter ? `(no changes matching "${filter}")` : '(no recent function changes)')];
}
function impactGraphLines(state, c, width, maxLines = 8) {
    const ug = state.understandingGraph;
    if (ug?.call_chain.length) {
        const lines = [
            truncate(`${c.dim('Recent change:')} ${ug.recent_change.name}`, width - 2),
            ...liveCallChainTree(ug.call_chain, c, width, maxLines),
        ];
        if (ug.affected.length > ug.call_chain.length) {
            lines.push(truncate(`${c.dim('Impact:')} ${ug.affected.slice(ug.call_chain.length, ug.call_chain.length + 6).join(', ')}`, width - 2));
        }
        lines.push(truncate(`${c.dim('Agent:')} ${ug.agent}`, width - 2));
        return lines.slice(0, maxLines + 4);
    }
    const graph = state.graph;
    if (!graph?.edges.length || !graph.nodes.length) {
        const fallback = state.handoff?.impact_summary.affected_functions ?? [];
        if (fallback.length >= 2) {
            return [truncate(fallback.slice(0, 6).join(' → '), width - 2)];
        }
        return [c.dim('(impact graph pending)')];
    }
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const lines = [];
    for (const edge of graph.edges.filter((e) => e.kind === 'calls').slice(0, 8)) {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) {
            continue;
        }
        if (!matchesFilter(from.name, undefined) && !matchesFilter(to.name, undefined)) {
            // still show graph edges
        }
        const chain = `${from.name} → ${to.name}`;
        const styled = state.handoff?.impact_summary.risk === 'high' ? c.red(chain) : chain;
        lines.push(truncate(styled, width - 2));
        if (lines.length >= 5) {
            break;
        }
    }
    return lines.length ? lines : [c.dim('(no call edges)')];
}
/** Unicode tree for live call-chain display in Expanded fullscreen. */
function liveCallChainTree(chain, c, width, maxLines) {
    const lines = [];
    const limit = Math.min(chain.length, maxLines);
    for (let i = 0; i < limit; i++) {
        const isLast = i === limit - 1;
        const branch = isLast ? '└─' : '├─';
        const indent = i > 0 ? `${'│ '.repeat(i - 1)}${isLast ? '  ' : '│ '}` : '';
        lines.push(truncate(`${indent}${branch} ${c.cyan(chain[i])}`, width - 2));
    }
    if (chain.length > limit) {
        lines.push(c.dim(`  … +${chain.length - limit} more`));
    }
    return lines;
}
function agentTimelineLines(state, c, width) {
    const writer = state.status.lastWriter ?? 'runtime';
    const lines = [];
    for (const kc of keyChanges(state).slice(0, 3)) {
        lines.push(truncate(`${writer}: function_update ${kc.symbol}`, width - 2));
    }
    for (const ev of state.recentEvents.slice(0, 4)) {
        const file = ev.file ? basenameOf(ev.file) : ev.detail ?? '';
        lines.push(truncate(`${c.dim(writer)}: ${ev.type}${file ? ` ${file}` : ''}`, width - 2));
    }
    return lines.length ? lines.slice(0, 6) : [c.dim('(no agent activity)')];
}
function structureLines(state, c, width) {
    const nodes = state.graph?.nodes ?? [];
    if (!nodes.length) {
        const top = state.snapshot?.topFunctions ?? [];
        if (top.length) {
            return top.slice(0, 5).map((fn) => truncate(`  ${fn}()`, width - 2));
        }
        return [c.dim('(structure empty)')];
    }
    const byFile = new Map();
    for (const node of nodes) {
        const dir = pathDir(node.file);
        const bucket = byFile.get(dir) ?? [];
        bucket.push(node);
        byFile.set(dir, bucket);
    }
    const lines = [];
    for (const dir of [...byFile.keys()].sort().slice(0, 3)) {
        lines.push(truncate(`${dir}/`, width - 2));
        for (const n of (byFile.get(dir) ?? [])
            .filter((n) => n.kind === 'function' || n.kind === 'class')
            .slice(0, 4)) {
            lines.push(truncate(`  ├── ${n.name}${n.kind === 'function' ? '()' : ''}`, width - 2));
        }
    }
    return lines;
}
function pathDir(file) {
    const norm = file.replace(/\\/g, '/');
    const idx = norm.lastIndexOf('/');
    return idx > 0 ? norm.slice(0, idx) : '.';
}
/** Copy To AI — user-facing actions (not internal handoff/export jargon). */
function copyToAiLines(state, c, width) {
    const chp = buildChpHandoffStateSync({
        workspaceRoot: state.workspaceRoot,
        handoff: state.handoff,
        change: state.change,
        currentTask: state.status.currentTask,
        lastWriter: state.status.lastWriter,
    });
    const lines = [
        c.cyan('Copy To AI — paste in your next chat:'),
        truncate('  Press c (or: contorium handoff --copy)', width - 2),
        truncate('  Semi-auto: auto on new chat · Enter/i in terminal · IDE [?] status bar', width - 2),
    ];
    if (chp) {
        lines.push('');
        lines.push(truncate(`  ${formatChpCompact(chp)}`, width - 2));
    }
    else {
        lines.push('');
        lines.push(c.dim('  (waiting for code changes — save a file or run sync)'));
    }
    lines.push('');
    lines.push(c.dim("Keys: Space toggle view · c Copy To AI · q quit"));
    lines.push(c.dim('Legacy: contorium export · IDE Copy AI-ready context'));
    return lines;
}
function statusLines(state, c, width) {
    const risk = state.handoff?.impact_summary.risk ?? 'low';
    const fileCount = state.change?.changed_files?.length ?? 0;
    const velocity = fileCount >= 5 ? 'HIGH' : fileCount >= 2 ? 'MEDIUM' : 'LOW';
    const health = risk === 'high' ? 'CAUTION' : risk === 'medium' ? 'OK' : 'GOOD';
    const riskStyled = risk === 'high' ? c.red('HIGH') : risk === 'medium' ? c.yellow('MEDIUM') : c.green('LOW');
    return [
        truncate(`Health: ${health}`, width - 2),
        truncate(`Change Velocity: ${velocity} (${fileCount} files)`, width - 2),
        truncate(`Risk: ${riskStyled}`, width - 2),
        truncate(`Mode: ${state.status.mode} · Events: ${state.status.eventCount}`, width - 2),
    ];
}
function section(title, body, width) {
    const hr = '─'.repeat(Math.max(16, width - 2));
    return [`[${title}]`, hr, ...body, ''];
}
/** Idle — waiting for IDE session (minimal, single line). */
export function renderIdleLine(ctx) {
    const c = createColors(ctx.useColor);
    return c.dim('[○] Contorium waiting for IDE session…');
}
/** Passive — CHP v1 compact status bar. */
export function renderPassiveLine(state, updateCount, ctx) {
    const c = createColors(ctx.useColor);
    const dot = c.green('●');
    const chp = buildChpHandoffStateSync({
        workspaceRoot: state.workspaceRoot,
        handoff: state.handoff,
        change: state.change,
        currentTask: state.status.currentTask,
        lastWriter: state.status.lastWriter,
    });
    const core = chp
        ? formatChpCompact(chp, ctx.filter)
        : `[Contorium] task: (idle) | last: — | agent: ${state.status.lastWriter ?? 'runtime'}`;
    const badge = updateCount > 0 && !chp?.recent_changes.length
        ? c.dim(` (+${updateCount})`)
        : '';
    const injectionPending = state.handoffInjection?.status === 'pending';
    const miniGraph = formatUnderstandingMiniGraph(state.understandingGraph, Math.max(24, ctx.width - 56));
    const miniSuffix = miniGraph ? c.dim(` · ${miniGraph}`) : '';
    const injectHint = injectionPending
        ? c.yellow(' · [?] Enter/i inject · n skip')
        : c.dim(" · Space toggle · c Copy To AI · q quit");
    return `[${dot}] ${core}${badge}${miniSuffix}${injectHint}`;
}
/** Expanded — full runtime dashboard (fullscreen TTY uses alternate screen buffer). */
export function renderExpanded(state, ctx) {
    const c = createColors(ctx.useColor);
    const w = ctx.width;
    const h = ctx.height ?? 24;
    const filterNote = ctx.filter ? c.cyan(` · filter: ${ctx.filter}`) : '';
    const liveBadge = ctx.live ? c.green(' LIVE') : '';
    const graphRows = Math.max(6, Math.floor(h * 0.35));
    const fnRows = Math.max(4, Math.floor(h * 0.2));
    const timelineRows = Math.max(3, Math.floor(h * 0.15));
    const header = [
        c.bold('=== Contorium Runtime Dashboard ===') + liveBadge,
        c.dim(`${state.workspaceRoot}${filterNote}`),
        c.dim(`updated ${new Date(state.loadedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} · Space toggle · c Copy To AI · q quit · fullscreen`),
        '',
    ];
    const injectionPending = state.handoffInjection?.status === 'pending';
    const injectionBanner = injectionPending
        ? [
            c.yellow('[?] Contorium runtime active — inject to new AI chat?'),
            c.dim('Press Enter or i to inject · n to skip · MCP: confirm_handoff_injection'),
            '',
        ]
        : [];
    const wide = w >= 100;
    const colW = wide ? Math.floor((w - 4) / 2) : w;
    const leftSections = wide
        ? [
            ...section('Impact Graph', impactGraphLines(state, c, colW, graphRows), colW),
            ...section('Agent Timeline', agentTimelineLines(state, c, colW).slice(0, timelineRows), colW),
        ]
        : [];
    const rightSections = [
        ...section('Function Updates', functionUpdateLines(state, c, colW, ctx.filter).slice(0, fnRows), colW),
        ...(wide
            ? []
            : [
                ...section('Impact Graph', impactGraphLines(state, c, colW, graphRows), colW),
                ...section('Agent Timeline', agentTimelineLines(state, c, colW).slice(0, timelineRows), colW),
            ]),
        ...section('Structure View', structureLines(state, c, colW).slice(0, 5), colW),
        ...section('Project Status', statusLines(state, c, colW), colW),
        ...section('Copy To AI', copyToAiLines(state, c, colW), colW),
    ];
    const body = wide ? mergeColumns(leftSections, rightSections, w) : rightSections;
    return [...header, ...injectionBanner, ...body].join('\n');
}
function mergeColumns(left, right, totalWidth) {
    const colW = Math.floor((totalWidth - 3) / 2);
    const maxRows = Math.max(left.length, right.length);
    const out = [];
    for (let i = 0; i < maxRows; i++) {
        const l = (left[i] ?? '').padEnd(colW).slice(0, colW);
        const r = (right[i] ?? '').slice(0, colW);
        out.push(`${l} │ ${r}`);
    }
    return out;
}
/** Legacy one-shot full frame. */
export function renderDashboardOnce(state, ctx) {
    return renderExpanded(state, { ...ctx, fsmState: 'expanded' });
}
