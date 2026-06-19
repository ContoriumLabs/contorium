import { buildGovernanceAwareExportText } from '@contora/state-core';
/** Unified export for dashboard [c], handoff --copy, inject, and contorium export. */
export async function buildDashboardExportText(workspaceRoot, state, filter) {
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
