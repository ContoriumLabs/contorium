import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readIntentGraphVNext } from '../intelligence/intentVNext.js';
import { readHandoffArtifact } from '../understanding/store.js';
import type { TransferStoryPayload } from './types.js';
import { getDecisionCenter } from './decisionCenter.js';
import { deriveNextActions } from './actionEngine.js';
import { exploreHistory } from './historyExplorer.js';
import { buildProjectJourney } from './journeyBuilder.js';
import { freshnessLabelText } from './confidenceLabels.js';

/** Transfer V2 / Project Story — narrative export for AI continuity. */
export async function buildTransferStory(workspaceRoot: string): Promise<TransferStoryPayload> {
  const [state, intents, handoff, history, center, actionItems, journey] = await Promise.all([
    readStateJson(workspaceRoot),
    readIntentGraphVNext(workspaceRoot),
    readHandoffArtifact(workspaceRoot),
    exploreHistory(workspaceRoot, 'last_7_days'),
    getDecisionCenter(workspaceRoot),
    deriveNextActions(workspaceRoot),
    buildProjectJourney(workspaceRoot),
  ]);

  const currentGoal =
    state?.currentTask?.trim() ||
    handoff?.current_focus?.trim() ||
    intents?.nodes?.[0]?.name ||
    'Not set';

  const currentDirection =
    intents?.nodes?.[0]?.description?.trim() ||
    handoff?.goal?.trim() ||
    'Not recorded';

  const projectSummary =
    handoff?.summary?.trim() ||
    handoff?.goal?.trim() ||
    `Project with ${history.count} recent cognitive event(s)`;

  const majorDecisions = center.decisions
    .filter((d) => d.status === 'accepted' || d.status === 'proposed')
    .slice(0, 5)
    .map((d) => `${d.id}: ${d.title} — ${d.reason}`);

  const milestones = history.events.slice(0, 6).map((e) => `${e.timestamp.slice(0, 10)}: ${e.title}`);
  const pendingRisks = center.decisions
    .filter((d) => d.risk === 'high' || d.freshness === 'stale' || d.status === 'proposed')
    .slice(0, 4)
    .map((d) => {
      const extra = d.superseded_by ? ` (superseded by ${d.superseded_by})` : '';
      return `${d.title} (${freshnessLabelText(d.freshness)}, risk ${d.risk})${extra}`;
    });

  const nextActions = actionItems.map((a) => `${a.task} — ${a.reason}`);

  const lines = [
    '# Project Story',
    '',
    '## Project Goal',
    projectSummary,
    '',
    '## Current Direction',
    currentDirection,
    '',
    '## Current Focus',
    currentGoal,
    '',
    '## Major Decisions',
    ...(majorDecisions.length ? majorDecisions.map((d) => `- ${d}`) : ['- None recorded']),
    '',
    '## Important Milestones',
    ...(milestones.length ? milestones.map((e) => `- ${e}`) : ['- None recorded']),
    '',
    '## Project Journey',
    ...journey.stages.map((s) => `- ${s.version}: ${s.label}`),
    '',
    '## Current Risks',
    ...(pendingRisks.length ? pendingRisks.map((r) => `- ${r}`) : ['- None flagged']),
    '',
    '## Next Actions',
    ...nextActions.map((a) => `- ${a}`),
    '',
  ];

  return {
    project_summary: projectSummary,
    current_goal: currentGoal,
    recent_decisions: majorDecisions,
    important_events: milestones,
    pending_risks: pendingRisks,
    next_actions: nextActions,
    formatted_markdown: lines.join('\n'),
  };
}
