import type { ColorFn } from './uiHelpers.js';

/** ASCII-safe pulse — CMD/PowerShell often render ◉/◎ identically to ● (looks static). */
export const STATUS_FRAMES = ['+', 'x', '*', 'x'] as const;

/** One fixed-width status glyph (animated); text beside it stays static. */
export function statusGlyph(tick: number, green: ColorFn, animate = true): string {
  if (!animate) {
    return green(STATUS_FRAMES[0]!);
  }
  return green(STATUS_FRAMES[tick % STATUS_FRAMES.length]!);
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
