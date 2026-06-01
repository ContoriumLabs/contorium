import type { WorkspaceEvent } from '../core/models/events';
import type { ProjectState } from '../types/state';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export interface FileActivityStats {
  path: string;
  editCount: number;
  saveCount: number;
  focusCount: number;
  lastTimestamp: number;
}

export function groupEventsByFile(events: readonly WorkspaceEvent[]): Map<string, FileActivityStats> {
  const map = new Map<string, FileActivityStats>();
  const touch = (path: string, ts: number, kind: 'edit' | 'save' | 'focus'): void => {
    const n = path.replace(/\\/g, '/').trim();
    if (!n) {
      return;
    }
    let row = map.get(n);
    if (!row) {
      row = { path: n, editCount: 0, saveCount: 0, focusCount: 0, lastTimestamp: ts };
      map.set(n, row);
    }
    if (kind === 'save') {
      row.saveCount++;
    } else if (kind === 'focus') {
      row.focusCount++;
    } else {
      row.editCount++;
    }
    if (ts > row.lastTimestamp) {
      row.lastTimestamp = ts;
    }
  };

  for (const ev of events) {
    if (ev.type === 'file_save') {
      touch(ev.file, ev.timestamp, 'save');
    } else if (ev.type === 'file_focus') {
      touch(ev.file, ev.timestamp, 'focus');
    } else if (ev.type === 'file_create' || ev.type === 'file_delete') {
      touch(ev.file, ev.timestamp, 'edit');
    } else if (ev.type === 'file_rename') {
      touch(ev.newFile, ev.timestamp, 'edit');
    }
  }
  return map;
}

export function groupEventsByTimeWindow(
  events: readonly WorkspaceEvent[],
  windowMs: number,
  now = Date.now(),
): WorkspaceEvent[] {
  const cutoff = now - windowMs;
  return events.filter((e) => e.timestamp >= cutoff);
}

export function recencyWeight(lastTimestamp: number, now = Date.now()): number {
  const ageMin = Math.max(0, (now - lastTimestamp) / 60_000);
  return Math.exp(-ageMin / 45);
}

export function scoreFile(
  stats: FileActivityStats,
  state: ProjectState,
  now = Date.now(),
): number {
  const editFrequency = stats.editCount + stats.saveCount * 0.5 + stats.focusCount * 0.35;
  const recency = recencyWeight(stats.lastTimestamp, now);
  const gitSet = new Set([...(state.gitStaged ?? []), ...(state.gitWorking ?? [])]);
  const gitChangeWeight = gitSet.has(stats.path) ? 1 : 0;
  const openSet = new Set(state.openFiles ?? []);
  const openTimeWeight = openSet.has(stats.path) ? 1 : 0;
  const normalizedEdit = Math.min(1, editFrequency / 8);
  return (
    normalizedEdit * 0.4 +
    recency * 0.3 +
    gitChangeWeight * 0.2 +
    openTimeWeight * 0.1
  );
}

export function rankedFileScores(
  events: readonly WorkspaceEvent[],
  state: ProjectState,
  now = Date.now(),
): Array<{ path: string; score: number }> {
  const windowed = groupEventsByTimeWindow(events, TWO_HOURS_MS, now);
  const byFile = groupEventsByFile(windowed);
  for (const p of [...(state.openFiles ?? []), ...(state.recentFiles ?? [])]) {
    const n = p.replace(/\\/g, '/').trim();
    if (!n || byFile.has(n)) {
      continue;
    }
    byFile.set(n, { path: n, editCount: 0, saveCount: 0, focusCount: 1, lastTimestamp: now });
  }
  return [...byFile.values()]
    .map((s) => ({ path: s.path, score: scoreFile(s, state, now) }))
    .filter((r) => r.score > 0.05)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

export function clusterFilesByDirectory(
  ranked: readonly { path: string; score: number }[],
  maxClusters = 5,
): Array<{ cluster: string; files: string[]; weight: number }> {
  const buckets = new Map<string, { files: string[]; weight: number }>();
  for (const { path, score } of ranked) {
    const parts = path.split('/').filter(Boolean);
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)';
    const label = dir === '(root)' ? 'project root' : dir.replace(/\//g, ' / ');
    let b = buckets.get(label);
    if (!b) {
      b = { files: [], weight: 0 };
      buckets.set(label, b);
    }
    b.files.push(path);
    b.weight += score;
  }
  return [...buckets.entries()]
    .map(([cluster, v]) => ({
      cluster,
      files: v.files.slice(0, 8),
      weight: Math.min(1, v.weight / Math.max(1, v.files.length)),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxClusters);
}
