import { buildGovernanceAwareExportText } from '@contora/state-core';
import type { DashboardState } from './types.js';

/** Unified export for dashboard [c], handoff --copy, inject, and contorium export. */
export async function buildDashboardExportText(
  workspaceRoot: string,
  state: DashboardState,
  filter?: string,
): Promise<string | undefined> {
  return buildGovernanceAwareExportText({
    workspaceRoot,
    handoff: state.handoff,
    change: state.change,
    currentTask: state.status.currentTask,
    lastWriter: state.status.lastWriter,
    timeline: state.timeline,
    filter,
    review: state.governance?.review ?? null,
  });
}
