import { padVisible, truncate, type ColorFn } from './uiHelpers.js';

/** Single-char frames — ASCII-safe, fixed visible width inside `[X]`. */
export const STATUS_FRAMES = ['+', 'x', '*', '.'] as const;

/** Visible width of `[X]` module marker (brackets + one glyph). */
export const MODULE_MARKER_WIDTH = 3;

/** One fixed-width status glyph (animated); text beside it stays static. */
export function statusGlyph(tick: number, green: ColorFn, animate = true): string {
  if (!animate) {
    return green(STATUS_FRAMES[0]!);
  }
  return green(STATUS_FRAMES[tick % STATUS_FRAMES.length]!);
}

/**
 * Fixed-width live marker for dynamic dashboard modules — `[+]`, `[x]`, …
 * Placeholder is always MODULE_MARKER_WIDTH columns so layout never shifts.
 */
export function liveModuleMarker(
  tick: number,
  active: boolean,
  c: Record<string, ColorFn>,
  animate = true,
): string {
  const ch =
    active && animate
      ? STATUS_FRAMES[tick % STATUS_FRAMES.length]!
      : active
        ? STATUS_FRAMES[0]!
        : '·';
  const glyph = active ? (c.green ?? ((t) => t))(ch) : (c.dim ?? ((t) => t))('·');
  return padVisible(`[${glyph}]`, MODULE_MARKER_WIDTH);
}

/** Section title with fixed-width animated marker prefix. */
export function liveModuleTitle(
  title: string,
  tick: number,
  active: boolean,
  c: Record<string, ColorFn>,
  width: number,
  animate = true,
): string {
  const marker = liveModuleMarker(tick, active, c, animate);
  const bold = c.bold ?? ((t) => t);
  return truncate(`${marker} ${bold(title)}`, width);
}

/** Section title with animated bracket glyph — original dashboard style. */
export function liveSectionTitle(
  title: string,
  tick: number,
  c: Record<string, ColorFn>,
  animate = true,
): string {
  const glyph = statusGlyph(tick, c.green ?? ((t) => t), animate);
  const bold = c.bold ?? ((t) => t);
  return `[${glyph} ${bold(title)}]`;
}

/** Inline section header — animated glyph + title (compact view). */
export function animatedSectionHeader(
  title: string,
  tick: number,
  c: Record<string, ColorFn>,
  animate = true,
): string {
  const glyph = statusGlyph(tick, c.green ?? ((t) => t), animate);
  const bold = c.bold ?? ((t) => t);
  return `${glyph} ${bold(title)}`;
}

/** Fixed-width header badge — glyph animates, label length never changes. */
export function monitoringBadge(
  tick: number,
  live: boolean,
  c: Record<string, ColorFn>,
): string {
  const glyph = statusGlyph(tick, c.green ?? ((t) => t), true);
  const dim = c.dim ?? ((t) => t);
  const label = live ? ' LIVE  ' : ' watch ';
  return ` ${glyph}${dim(label)}`;
}
