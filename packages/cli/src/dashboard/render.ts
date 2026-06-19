import { buildChpHandoffStateSync, formatChpCompact, formatUnderstandingMiniGraph } from '@contora/state-core';
import type { GraphNode, KeyChange } from '@contora/state-core';
import {
  renderCognitiveModeSelectorLines,
} from './cognitiveModePanel.js';
import {
  DASHBOARD_TITLE_V4,
  renderDecisionFeedLines,
  renderDecisionTraceLines,
  renderGovernanceRawLines,
  renderGovernanceSummaryLines,
  renderScopeMapLines,
} from './governancePanel.js';
import { renderKeyHintLines } from './keyHints.js';
import { liveSectionTitle, monitoringBadge, statusGlyph } from './statusAnimation.js';
import { progressBar, projectLabel, projectMetrics, sectionDivider } from './uiHelpers.js';
import type { DashboardState, RenderContext } from './types.js';

type ColorFn = (text: string) => string;

function createColors(enabled: boolean): Record<string, ColorFn> {
  const wrap =
    (code: string): ColorFn =>
    (text) =>
      enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
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

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

const EVENT_GLYPH = '>';

function uiTick(ctx: RenderContext): number {
  return ctx.tickCount ?? 0;
}

/** Strip ANSI for terminal column padding. */
function visibleLength(text: string): number {
  return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').length;
}

function padVisible(text: string, width: number): string {
  const pad = Math.max(0, width - visibleLength(text));
  return `${text}${' '.repeat(pad)}`;
}

/** Passive event log line — static text, fixed prefix glyph (no animation). */
export function renderPassiveEventLine(
  source: string,
  kind: string,
  detail: string | undefined,
  ctx: RenderContext,
): string {
  const c = createColors(ctx.useColor);
  const body = detail?.trim() ? `${kind} ${detail.trim()}` : kind;
  return `${c.dim(EVENT_GLYPH)} ${c.dim(`${source}: ${body}`)}`;
}

function basenameOf(rel: string): string {
  const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : rel;
}

function matchesFilter(symbol: string, filter?: string): boolean {
  if (!filter?.trim()) {
    return true;
  }
  return symbol.toLowerCase().includes(filter.trim().toLowerCase());
}

function changePrefix(changeType: KeyChange['change_type'], c: Record<string, ColorFn>): string {
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

function formatFunctionChange(kc: KeyChange, c: Record<string, ColorFn>): string {
  const prefix = changePrefix(kc.change_type, c);
  const sym = kc.kind === 'function' ? `${kc.symbol}()` : kc.symbol;
  return `${prefix} ${sym}`;
}

function keyChanges(state: DashboardState, filter?: string): KeyChange[] {
  const raw = state.handoff?.key_changes?.length
    ? state.handoff.key_changes
    : state.change?.key_changes ?? [];
  return raw.filter((k) => matchesFilter(k.symbol, filter));
}

function functionUpdateLines(
  state: DashboardState,
  c: Record<string, ColorFn>,
  width: number,
  filter?: string,
): string[] {
  const changes = keyChanges(state, filter)
    .filter((k) => k.kind === 'function' || k.kind === 'class')
    .slice(0, 8);

  if (changes.length) {
    return changes.map((kc) => truncate(formatFunctionChange(kc, c), width - 2));
  }

  const files = (state.change?.changed_files ?? [])
    .filter((f) => matchesFilter(f, filter))
    .slice(0, 6);
  if (files.length) {
    return files.map((f) => truncate(`${c.dim('~')} ${f.replace(/\\/g, '/')}`, width - 2));
  }

  return [c.dim(filter ? `(no changes matching "${filter}")` : '(no recent function changes)')];
}

function impactGraphLines(
  state: DashboardState,
  c: Record<string, ColorFn>,
  width: number,
  maxLines = 8,
): string[] {
  const ug = state.understandingGraph;
  if (ug?.call_chain.length) {
    const lines: string[] = [
      truncate(`${c.dim('Recent change:')} ${ug.recent_change.name}`, width - 2),
      ...liveCallChainTree(ug.call_chain, c, width, maxLines),
    ];
    if (ug.affected.length > ug.call_chain.length) {
      lines.push(
        truncate(
          `${c.dim('Impact:')} ${ug.affected.slice(ug.call_chain.length, ug.call_chain.length + 6).join(', ')}`,
          width - 2,
        ),
      );
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
  const lines: string[] = [];
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
function liveCallChainTree(
  chain: string[],
  c: Record<string, ColorFn>,
  width: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  const limit = Math.min(chain.length, maxLines);
  for (let i = 0; i < limit; i++) {
    const isLast = i === limit - 1;
    const branch = isLast ? '└─' : '├─';
    const indent = i > 0 ? `${'│ '.repeat(i - 1)}${isLast ? '  ' : '│ '}` : '';
    lines.push(truncate(`${indent}${branch} ${c.cyan(chain[i]!)}`, width - 2));
  }
  if (chain.length > limit) {
    lines.push(c.dim(`  … +${chain.length - limit} more`));
  }
  return lines;
}

function agentTimelineLines(state: DashboardState, c: Record<string, ColorFn>, width: number): string[] {
  const writer = state.status.lastWriter ?? 'runtime';
  const lines: string[] = [];

  for (const kc of keyChanges(state).slice(0, 3)) {
    lines.push(truncate(`${writer}: function_update ${kc.symbol}`, width - 2));
  }

  for (const ev of state.recentEvents.slice(0, 4)) {
    const file = ev.file ? basenameOf(ev.file) : ev.detail ?? '';
    lines.push(truncate(`${c.dim(writer)}: ${ev.type}${file ? ` ${file}` : ''}`, width - 2));
  }

  return lines.length ? lines.slice(0, 6) : [c.dim('(no agent activity)')];
}

function structureLines(state: DashboardState, c: Record<string, ColorFn>, width: number): string[] {
  const nodes = state.graph?.nodes ?? [];
  if (!nodes.length) {
    const top = state.snapshot?.topFunctions ?? [];
    if (top.length) {
      return top.slice(0, 5).map((fn) => truncate(`  ${fn}()`, width - 2));
    }
    return [c.dim('(structure empty)')];
  }

  const byFile = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const dir = pathDir(node.file);
    const bucket = byFile.get(dir) ?? [];
    bucket.push(node);
    byFile.set(dir, bucket);
  }

  const lines: string[] = [];
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

function pathDir(file: string): string {
  const norm = file.replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return idx > 0 ? norm.slice(0, idx) : '.';
}

/** Copy To AI — user-facing actions (not internal handoff/export jargon). */
function copyToAiLines(state: DashboardState, c: Record<string, ColorFn>, width: number): string[] {
  const chp = buildChpHandoffStateSync({
    workspaceRoot: state.workspaceRoot,
    handoff: state.handoff,
    change: state.change,
    currentTask: state.status.currentTask,
    lastWriter: state.status.lastWriter,
  });

  const lines: string[] = [
    c.cyan('Copy To AI — paste in your next chat:'),
    truncate('  Press c (or: contorium handoff --copy)', width - 2),
    truncate('  Semi-auto: auto on new chat · Enter/i in terminal · IDE [?] status bar', width - 2),
  ];

  if (chp) {
    lines.push('');
    lines.push(truncate(`  ${formatChpCompact(chp)}`, width - 2));
  } else {
    lines.push('');
    lines.push(c.dim('  (waiting for code changes — save a file or run sync)'));
  }

  lines.push('');
  lines.push(c.dim("Keys: Space toggle view · c Copy To AI · q quit"));
  lines.push(c.dim('Legacy: contorium export · IDE Copy AI-ready context'));

  return lines;
}

function statusLines(state: DashboardState, c: Record<string, ColorFn>, width: number): string[] {
  const risk = state.handoff?.impact_summary.risk ?? 'low';
  const fileCount = state.change?.changed_files?.length ?? 0;
  const velocity = fileCount >= 5 ? 'HIGH' : fileCount >= 2 ? 'MEDIUM' : 'LOW';
  const health = risk === 'high' ? 'CAUTION' : risk === 'medium' ? 'OK' : 'GOOD';
  const riskStyled =
    risk === 'high' ? c.red('HIGH') : risk === 'medium' ? c.yellow('MEDIUM') : c.green('LOW');

  return [
    truncate('Monitor: active', width - 2),
    truncate(`Health: ${health}`, width - 2),
    truncate(`Change Velocity: ${velocity} (${fileCount} files)`, width - 2),
    truncate(`Risk: ${riskStyled}`, width - 2),
    truncate(`Mode: ${state.status.mode} · Events: ${state.status.eventCount}`, width - 2),
  ];
}

function section(
  title: string,
  body: string[],
  width: number,
  opts?: { tick?: number; c?: Record<string, ColorFn>; animate?: boolean },
): string[] {
  const hr = '─'.repeat(Math.max(16, width - 2));
  const heading =
    opts?.animate && opts.c !== undefined && opts.tick !== undefined
      ? liveSectionTitle(title, opts.tick, opts.c, true)
      : `[${title}]`;
  return [heading, hr, ...body, ''];
}

/** Idle — waiting for IDE session (minimal, single line). */
export function renderIdleLine(ctx: RenderContext): string {
  const c = createColors(ctx.useColor);
  return c.dim('[○] Contorium waiting for IDE session…');
}

/** Passive — CHP v1 compact status bar. */
export function renderPassiveLine(
  state: DashboardState,
  updateCount: number,
  ctx: RenderContext,
): string {
  const c = createColors(ctx.useColor);
  const tick = uiTick(ctx);
  const dot = statusGlyph(tick, c.green, true);
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

  const injectionPending = state.handoffInjection?.status === 'pending';
  const miniGraph = formatUnderstandingMiniGraph(state.understandingGraph, Math.max(24, ctx.width - 56));
  const miniSuffix = miniGraph ? c.dim(` · ${miniGraph}`) : '';
  const injectHint = injectionPending
    ? c.yellow(' · [?] Enter/i inject · n skip')
    : c.dim(' · ↑↓ mode · Enter apply · Space expand · c Copy · q quit');
  void updateCount;
  return `[${dot}] ${core}${miniSuffix}${injectHint}`;
}

function runtimeFeedLines(state: DashboardState, c: Record<string, ColorFn>, width: number): string[] {
  const writer = state.status.lastWriter ?? 'mcp';
  const lines: string[] = [];

  for (const kc of keyChanges(state).slice(0, 4)) {
    const file = kc.symbol.replace(/\\/g, '/').split('/').pop() ?? kc.symbol;
    lines.push(truncate(`${writer}:update ${file}`, width));
  }
  for (const ev of state.recentEvents.slice(0, 4)) {
    const file = ev.file ? basenameOf(ev.file) : ev.detail ?? '';
    lines.push(truncate(`${writer}:${ev.type}${file ? ` ${file}` : ''}`, width));
  }
  return lines.length ? lines.slice(0, 6) : [c.dim('(no runtime feed)')];
}

function projectStatusFullLines(state: DashboardState, c: Record<string, ColorFn>, width: number): string[] {
  const m = projectMetrics(state);
  const riskStyled =
    m.riskLevel === 'high' ? c.red(m.risk) : m.riskLevel === 'medium' ? c.yellow(m.risk) : c.green(m.risk);

  return [
    truncate(`Monitor : ACTIVE`, width),
    truncate(`Health  : ${m.health}`, width),
    truncate(`Velocity: ${m.velocity} (${m.fileCount} files)`, width),
    truncate(`Risk    : ${riskStyled}`, width),
    truncate(`Events  : ${m.eventCount}`, width),
    '',
    truncate('Velocity', width),
    truncate(`${progressBar(m.velocityRatio)} ${m.velocity}`, width),
  ];
}

function exportGovernanceCompactLines(
  state: DashboardState,
  c: Record<string, ColorFn>,
  width: number,
): string[] {
  const hasReview = Boolean(state.governance?.review);
  const lines = [
    truncate(hasReview ? 'Press [c] Export Governance Context' : 'Press [c] to copy context', width),
    truncate(hasReview ? 'Governance YAML + rules for AI chat' : 'Paste into your next AI chat', width),
  ];
  if (state.governance?.review) {
    const r = state.governance.review!;
    lines.push(truncate(`${r.risk.toUpperCase()} · ${state.governance.decision_action}`, width));
    lines.push(truncate(r.file, width));
  } else {
    const chp = buildChpHandoffStateSync({
      workspaceRoot: state.workspaceRoot,
      handoff: state.handoff,
      change: state.change,
      currentTask: state.status.currentTask,
      lastWriter: state.status.lastWriter,
    });
    if (chp) {
      lines.push(truncate(formatChpCompact(chp), width));
    } else {
      lines.push(c.dim('Run governance cycle or save changes…'));
    }
  }
  return lines;
}

function panelSection(
  title: string,
  body: string[],
  c: Record<string, ColorFn>,
  width: number,
  tick: number,
): string[] {
  return [liveSectionTitle(title, tick, c, true), sectionDivider(width), ...body, ''];
}

/** Expanded — full cognitive view (Space toggle from compact). */
export function renderExpanded(state: DashboardState, ctx: RenderContext): string {
  const c = createColors(ctx.useColor);
  const w = ctx.width;
  const colW = Math.max(28, Math.floor((w - 5) / 2));
  const tick = uiTick(ctx);
  const injectionPending = state.handoffInjection?.status === 'pending';
  const gov = state.governance;
  const modeActive = ctx.cognitiveModeActive ?? 'A';

  const left = [
    ...panelSection('Decision Feed', renderDecisionFeedLines(state, gov, ctx.useColor, colW), c, colW, tick),
    ...panelSection('Scope Map', renderScopeMapLines(gov, ctx.useColor, colW), c, colW, tick),
    ...panelSection(
      'Export Context',
      exportGovernanceCompactLines(state, c, colW),
      c,
      colW,
      tick,
    ),
  ];

  const right = [
    ...panelSection(
      'Governance Summary',
      renderGovernanceSummaryLines(gov, ctx.useColor, colW),
      c,
      colW,
      tick,
    ),
    ...panelSection(
      'View Mode',
      renderCognitiveModeSelectorLines({
        selection: ctx.cognitiveModeSelection ?? 'A',
        active: modeActive,
        useColor: ctx.useColor,
        width: colW,
        tick,
      }),
      c,
      colW,
      tick,
    ),
    ...panelSection(
      modeActive === 'B' ? 'Governance View' : 'Decision Trace',
      modeActive === 'B'
        ? renderGovernanceRawLines(gov, ctx.useColor, colW)
        : renderDecisionTraceLines(gov, ctx.useColor, colW),
      c,
      colW,
      tick,
    ),
  ];

  const inner = Math.max(40, w - 4);
  const top = `┌${'─'.repeat(inner)}┐`;
  const titleText = `${c.bold(DASHBOARD_TITLE_V4)}${monitoringBadge(tick, ctx.live === true, c)}`;
  const title = `│ ${padVisible(titleText, inner)} │`;
  const colSep = `├${'─'.repeat(colW)}┬${'─'.repeat(Math.max(0, inner - colW - 1))}┤`;
  const body = mergeColumns(left, right, w).map((line) => `│ ${padVisible(line, inner)} │`);
  const keyLines = renderKeyHintLines({
    injectionPending,
    useColor: ctx.useColor,
    width: inner,
    view: 'expanded',
    hasGovernanceReview: Boolean(gov?.review),
  });
  const footRows = keyLines.map((line) => `│ ${padVisible(line, inner)} │`);
  const bottom = `└${'─'.repeat(inner)}┘`;

  return [top, title, colSep, ...body, ...footRows, bottom].join('\n');
}

function mergeColumns(left: string[], right: string[], totalWidth: number): string[] {
  const colW = Math.floor((totalWidth - 3) / 2);
  const maxRows = Math.max(left.length, right.length);
  const out: string[] = [];
  for (let i = 0; i < maxRows; i++) {
    const lPadded = padVisible(left[i] ?? '', colW);
    const rPadded = padVisible(right[i] ?? '', colW);
    out.push(`${lPadded} │ ${rPadded}`);
  }
  return out;
}

/** Legacy one-shot full frame. */
export function renderDashboardOnce(state: DashboardState, ctx: RenderContext): string {
  return renderExpanded(state, { ...ctx, fsmState: 'expanded' });
}
