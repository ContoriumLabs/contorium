import type { HistoryExplorerResult, HistoryRange } from './types.js';
import { freshnessLabelText } from './confidenceLabels.js';
import { readAllCognitiveEvents } from './eventStore.js';
import type { CognitiveEvent } from './types.js';
import { exploreModuleHistory, filterEventsByModule } from './moduleHistory.js';

function rangeBounds(range: HistoryRange, now = Date.now()): { from: number; to: number } {
  const to = now;
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case 'today':
      return { from: now - day, to };
    case 'yesterday':
      return { from: now - 2 * day, to: now - day };
    case 'last_7_days':
      return { from: now - 7 * day, to };
    case 'last_30_days':
      return { from: now - 30 * day, to };
    case 'all':
    default:
      return { from: 0, to };
  }
}

function formatEventBlock(evt: CognitiveEvent): string[] {
  const date = evt.timestamp.slice(0, 10);
  const lines = [
    date,
    '',
    evt.title,
    '',
  ];
  if (evt.version) {
    lines.push(`Version: ${evt.version}`, '');
  }
  if (evt.why) {
    lines.push('WHY', evt.why, '');
  }
  if (evt.decision) {
    lines.push('DECISION', evt.decision, '');
  }
  if (evt.impact.length) {
    lines.push('IMPACT', ...evt.impact, '');
  }
  if (evt.files.length) {
    lines.push('FILES', ...evt.files.slice(0, 8).map((f) => `  ${f}`), '');
  }
  if (evt.provenance?.length) {
    lines.push('SOURCE', ...evt.provenance.map((p) => `  ${p}`), '');
  }
  lines.push(`Freshness: ${freshnessLabelText(evt.freshness)}`, '');
  return lines;
}

export async function exploreHistory(
  workspaceRoot: string,
  range: HistoryRange = 'last_7_days',
): Promise<HistoryExplorerResult> {
  const all = await readAllCognitiveEvents(workspaceRoot);
  const { from, to } = rangeBounds(range);
  const events = all.filter((e) => {
    const ts = Date.parse(e.timestamp);
    return ts >= from && ts <= to;
  });

  const formatted: string[] = [`Project History (${range})`, `${events.length} Cognitive Events`, ''];
  for (const evt of events.slice(0, 24)) {
    formatted.push(...formatEventBlock(evt));
  }

  return { range, count: events.length, events, formatted };
}

export async function getRecentEvents(
  workspaceRoot: string,
  limit = 10,
): Promise<CognitiveEvent[]> {
  const all = await readAllCognitiveEvents(workspaceRoot);
  return all.slice(0, limit);
}

export async function getModuleHistory(
  workspaceRoot: string,
  modulePath: string,
  limit = 20,
): Promise<CognitiveEvent[]> {
  const all = await readAllCognitiveEvents(workspaceRoot);
  return filterEventsByModule(all, modulePath).slice(0, limit);
}

export async function exploreModuleHistoryFeed(
  workspaceRoot: string,
  module: string,
): Promise<{ module: string; formatted: string[] }> {
  const all = await readAllCognitiveEvents(workspaceRoot);
  const result = await exploreModuleHistory(workspaceRoot, module, all);
  return { module: result.module, formatted: result.formatted };
}
