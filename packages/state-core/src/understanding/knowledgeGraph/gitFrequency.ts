import type { BootstrapStateJson } from '../../types.js';
import type { ProjectTimeline } from '../types.js';

function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Git activity weights for Hotspot Layer — from timeline + state.json git paths. */
export function buildGitFrequency(
  timeline: ProjectTimeline | undefined,
  state: BootstrapStateJson,
): Map<string, number> {
  const freq = new Map<string, number>();
  for (const e of timeline?.recent ?? []) {
    const f = norm(e.file);
    freq.set(f, (freq.get(f) ?? 0) + 1);
  }
  for (const p of [...state.gitStaged, ...state.gitWorking]) {
    const f = norm(p);
    freq.set(f, (freq.get(f) ?? 0) + 2);
  }
  return freq;
}
