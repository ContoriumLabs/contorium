import type { ChangeArtifact, HandoffArtifact, ProjectTimeline } from '../understanding/types.js';
import {
  buildChpHandoffStateSync,
  formatChpMarkdown,
  type ChpHandoffState,
} from '../understanding/chpHandoff.js';
import {
  buildGovernanceSupplement,
  loadGovernanceArtifactBundle,
} from './governanceArtifacts.js';
import {
  formatGovernanceExportSection,
  type GovernanceReviewArtifact,
} from './governanceReview.js';

/** Governance appendix = YAML section + unified DECISION/SCOPE/TRACE supplement. */
export async function buildGovernanceExportAppendixFull(
  workspaceRoot: string,
  review: GovernanceReviewArtifact | null,
): Promise<string> {
  const [section, bundle] = await Promise.all([
    formatGovernanceExportSection(workspaceRoot, review),
    loadGovernanceArtifactBundle(workspaceRoot),
  ]);
  const effectiveBundle = review ? { ...bundle, review: review ?? bundle.review } : bundle;
  const supplement = buildGovernanceSupplement(effectiveBundle);
  return `${section}${supplement}`.trim();
}

export interface GovernanceAwareExportInput {
  workspaceRoot: string;
  handoff?: HandoffArtifact | null;
  change?: ChangeArtifact | null;
  currentTask?: string;
  lastWriter?: string;
  timeline?: ProjectTimeline | null;
  filter?: string;
  review?: GovernanceReviewArtifact | null;
}

/**
 * Unified export body — handoff/CHP + governance appendix.
 * Used by CLI [c], handoff --copy, contorium export, IDE, MCP export.
 */
export async function buildGovernanceAwareExportText(
  input: GovernanceAwareExportInput,
): Promise<string | undefined> {
  const review =
    input.review ??
    (await loadGovernanceArtifactBundle(input.workspaceRoot)).review ??
    null;

  const governanceBlock = await buildGovernanceExportAppendixFull(input.workspaceRoot, review);

  const chp = buildChpHandoffStateSync({
    workspaceRoot: input.workspaceRoot,
    handoff: input.handoff,
    change: input.change,
    currentTask: input.currentTask,
    lastWriter: input.lastWriter,
  });

  if (chp) {
    const trimmed = input.filter?.trim();
    const chpState: ChpHandoffState = trimmed
      ? {
          ...chp,
          recent_changes: chp.recent_changes.filter((c) =>
            c.name.toLowerCase().includes(trimmed.toLowerCase()),
          ),
        }
      : chp;
    const body = formatChpMarkdown(chpState, input.handoff, input.timeline ?? undefined);
    return governanceBlock ? `${body}\n\n${governanceBlock}` : body;
  }

  return governanceBlock || undefined;
}
