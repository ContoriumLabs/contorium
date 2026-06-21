import { buildGovernanceAwareExportText, loadTransferExportInput, buildTransferContextSnapshot, formatTransferContextMarkdown, finalizeTransferContextText, setGitSubprocessAllowed, syncWorkspaceState, } from '@contora/state-core';
/** Unified export for legacy handoff --copy, inject, and contorium export. */
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
/** PIL Transfer Context — Cognitive Snapshot for dashboard [c] (v3.0). */
export async function buildTransferContextText(workspaceRoot) {
    setGitSubprocessAllowed(true);
    await syncWorkspaceState(workspaceRoot, 'cli', { refreshGit: true, forceArtifacts: true });
    const input = await loadTransferExportInput(workspaceRoot);
    const snapshot = await buildTransferContextSnapshot(input);
    const raw = formatTransferContextMarkdown(snapshot);
    return finalizeTransferContextText(raw, false);
}
