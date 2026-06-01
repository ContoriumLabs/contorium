import type { ProjectState } from '../types/state';

/** L0 — user-stated anchor only; never fed into state inference. */
export function extractTaskAnchor(state: ProjectState): string {
  return (state.currentTask ?? '').trim();
}
