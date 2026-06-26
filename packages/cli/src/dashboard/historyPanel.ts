/**
 * CIL History lens — project event feed for Dashboard view D.
 */
import { liveModuleTitle } from './statusAnimation.js';
import type { RenderContext } from './types.js';
import { padVisible, truncate, type ColorFn } from './uiHelpers.js';

function colors(useColor: boolean): Record<string, ColorFn> {
  const wrap =
    (code: string): ColorFn =>
    (text) =>
      useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
  return { bold: wrap('1'), dim: wrap('2'), cyan: wrap('36'), yellow: wrap('33') };
}

/** List sections in CIL history — render body in two columns to save vertical space. */
const TWO_COL_SECTIONS = new Set(['IMPACT', 'FILES', 'SOURCE']);

/** Max items per list section in dashboard (newest-first within each event). */
const MAX_SECTION_ITEMS = 5;

/** Max cognitive events shown in dashboard Project History lens. */
const MAX_HISTORY_EVENTS = 3;

function isListSectionHeader(line: string): boolean {
  return TWO_COL_SECTIONS.has(line.trim());
}

function isNonListLine(line: string): boolean {
  const t = line.trim();
  if (!t) {
    return true;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return true;
  }
  return /^(WHY|DECISION|Version:|Freshness:|Project History|Cognitive Events)/i.test(t);
}

function normalizeListItem(line: string): string {
  return line.trim().replace(/^  +/, '');
}

function isEventDateLine(line: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(line.trim());
}

/** Keep header + N newest events (exploreHistory is already newest-first). */
export function trimHistoryEvents(lines: string[], maxEvents: number): string[] {
  const header: string[] = [];
  const events: string[][] = [];
  let i = 0;
  while (i < lines.length && !isEventDateLine(lines[i]!)) {
    header.push(lines[i]!);
    i++;
  }
  while (i < lines.length) {
    if (!isEventDateLine(lines[i]!)) {
      i++;
      continue;
    }
    const block: string[] = [];
    while (i < lines.length) {
      block.push(lines[i]!);
      i++;
      if (i < lines.length && isEventDateLine(lines[i]!)) {
        break;
      }
    }
    events.push(block);
  }
  const kept = events.slice(0, maxEvents);
  const omitted = events.length - kept.length;
  const out = [...header];
  if (omitted > 0) {
    out.push(`(${omitted} older event(s) hidden — run contorium history for full feed)`, '');
  }
  for (const block of kept) {
    out.push(...block);
  }
  return out;
}

/** Split long vertical file lists into two side-by-side columns (terminal-friendly). */
export function layoutHistoryTwoColumn(lines: string[], width: number): string[] {
  const out: string[] = [];
  const streamIndent = 2;
  const usable = Math.max(28, width - streamIndent);
  const colGap = ' │ ';
  const colW = Math.max(10, Math.floor((usable - colGap.length) / 2));

  for (let i = 0; i < lines.length; ) {
    const line = lines[i]!;
    if (isListSectionHeader(line)) {
      out.push(line);
      i++;
      const items: string[] = [];
      while (i < lines.length) {
        const raw = lines[i]!;
        if (!raw.trim()) {
          break;
        }
        if (isListSectionHeader(raw) || isNonListLine(raw)) {
          break;
        }
        items.push(normalizeListItem(raw));
        i++;
      }
      if (!items.length) {
        continue;
      }
      const total = items.length;
      const capped = items.slice(0, MAX_SECTION_ITEMS);
      const half = Math.ceil(capped.length / 2);
      const leftCol = capped.slice(0, half);
      const rightCol = capped.slice(half);
      const rows = Math.max(leftCol.length, rightCol.length);
      for (let r = 0; r < rows; r++) {
        const l = truncate(leftCol[r] ?? '', colW);
        const rr = truncate(rightCol[r] ?? '', colW);
        out.push(`${padVisible(l, colW)}${colGap}${rr}`);
      }
      if (total > MAX_SECTION_ITEMS) {
        out.push(`(+${total - MAX_SECTION_ITEMS} more)`);
      }
      continue;
    }
    out.push(line);
    i++;
  }
  return out;
}

function streamBlock(
  title: string,
  body: string[],
  c: Record<string, ColorFn>,
  width: number,
): string[] {
  const lines: string[] = [truncate(c.bold(title), width)];
  if (!body.length) {
    lines.push(truncate(c.dim('  (empty)'), width));
    return lines;
  }
  for (const line of body) {
    lines.push(truncate(`  ${line}`, width));
  }
  return lines;
}

/** History lens — CIL cognitive event feed (last 7 days). */
export function renderHistoryStreams(
  historyLines: string[] | undefined,
  ctx: Pick<RenderContext, 'useColor' | 'width' | 'tickCount' | 'live'>,
): string[] {
  const c = colors(ctx.useColor);
  const w = ctx.width;
  const tick = ctx.tickCount ?? 0;
  const rawLines = historyLines?.length
    ? historyLines
    : [c.dim('Loading project history…'), c.dim('(run contorium sync if empty)')];
  const trimmed = trimHistoryEvents(rawLines, MAX_HISTORY_EVENTS);
  const lines = layoutHistoryTwoColumn(trimmed, w);

  return [
    liveModuleTitle('Project History', tick, ctx.live === true, c, w),
    truncate('─'.repeat(Math.max(16, w - 4)), w),
    c.dim('CIL · last 7 days · cognitive events'),
    ...streamBlock('Timeline', lines, c, w),
  ];
}
