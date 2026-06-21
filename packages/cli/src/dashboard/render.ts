import type { DashboardState, RenderContext } from './types.js';
import {
  renderCognitiveMainPanel,
  renderCognitiveShortcutFooter,
} from './cognitiveRenderer.js';
import { shortcutScrollHintBoxed } from './keyHints.js';
import { terminalHeight } from './terminalUi.js';

/** Idle — waiting for IDE session (minimal, single line). */
export function renderIdleLine(ctx: RenderContext): string {
  const dim = ctx.useColor ? '\x1b[2m' : '';
  const reset = ctx.useColor ? '\x1b[0m' : '';
  return `${dim}[○] Contorium waiting for IDE session…${reset}`;
}

/**
 * Truncate shortcut footer only — main panel is never clipped.
 * When truncated, reserves space for a scroll/resize hint before the bottom border.
 */
function buildTruncatedShortcutFooter(
  fullFooter: string[],
  footerBudget: number,
  scrollHintLine: string,
): string[] {
  if (footerBudget <= 0) {
    return [];
  }
  if (footerBudget >= fullFooter.length) {
    return fullFooter;
  }

  const sep = fullFooter[0]!;
  const bottom = fullFooter[fullFooter.length - 1]!;
  const title = fullFooter[1] ?? `│ Shortcuts │`;
  const keyLines = fullFooter.slice(2, -1);

  if (footerBudget === 1) {
    return [scrollHintLine];
  }
  if (footerBudget === 2) {
    return [sep, scrollHintLine];
  }
  if (footerBudget === 3) {
    return [sep, title, scrollHintLine];
  }
  if (footerBudget === 4) {
    return [sep, title, scrollHintLine, bottom];
  }

  const keySlots = footerBudget - 4;
  return [sep, title, ...keyLines.slice(0, keySlots), scrollHintLine, bottom];
}

/**
 * Full-screen dashboard: main content is always complete.
 * If vertical space is tight, shortcut help is truncated first with a scroll hint.
 */
export function assembleDashboardFrame(state: DashboardState, ctx: RenderContext): string {
  const rows = ctx.height ?? terminalHeight();
  const inner = Math.max(40, ctx.width - 4);
  const main = renderCognitiveMainPanel(state, ctx);
  const fullFooter = renderCognitiveShortcutFooter(state, ctx);
  const scrollHintLine = shortcutScrollHintBoxed(inner, ctx.useColor);

  const totalIfFull = main.length + fullFooter.length;

  if (totalIfFull <= rows) {
    const pad = rows - totalIfFull;
    return [...main, ...Array(Math.max(0, pad)).fill(''), ...fullFooter].join('\n');
  }

  const footerBudget = rows - main.length;

  if (footerBudget <= 0) {
    return [...main, ...fullFooter, scrollHintLine].join('\n');
  }

  if (footerBudget >= fullFooter.length) {
    return [...main, ...fullFooter].join('\n');
  }

  const truncatedFooter = buildTruncatedShortcutFooter(fullFooter, footerBudget, scrollHintLine);
  return [...main, ...truncatedFooter].join('\n');
}

/** Full cognitive state dashboard (single layout; no compact toggle). */
export function renderExpanded(state: DashboardState, ctx: RenderContext): string {
  return assembleDashboardFrame(state, ctx);
}

/** Legacy one-shot full frame. */
export function renderDashboardOnce(state: DashboardState, ctx: RenderContext): string {
  return renderExpanded(state, ctx);
}
