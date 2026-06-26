import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readIntentGraphVNext } from '../intelligence/intentVNext.js';
import { computeCognitiveHealth } from './cognitiveHealth.js';
import { detectDecisionContradictions } from './decisionConsistency.js';
import { readAllAdrRecords, readAllCognitiveEvents } from './eventStore.js';
import { buildProjectJourney } from './journeyBuilder.js';
import type { ProjectEssence } from './types.js';

/** P2 — compress long project memory into Project Essence for AI transfer. */
export async function buildProjectEssence(workspaceRoot: string): Promise<ProjectEssence> {
  const [events, adrs, state, intents, journey, health] = await Promise.all([
    readAllCognitiveEvents(workspaceRoot),
    readAllAdrRecords(workspaceRoot),
    readStateJson(workspaceRoot),
    readIntentGraphVNext(workspaceRoot),
    buildProjectJourney(workspaceRoot),
    computeCognitiveHealth(workspaceRoot),
  ]);

  const phases = journey.stages.map((s) => s.label).slice(0, 6);
  const keyDecisions = adrs
    .filter((a) => a.status === 'accepted' || a.status === 'proposed')
    .slice(0, 8)
    .map((a) => a.title);

  const currentFocus =
    state?.currentTask?.trim() ||
    intents?.nodes?.[0]?.name ||
    'Not set';

  const conflicts = detectDecisionContradictions(adrs);
  const openRisks = [
    ...health.warnings.filter((w) => w.severity !== 'low').map((w) => w.message),
    ...conflicts.map((c) => `Decision conflict: ${c.decision_title} vs ${c.by_title}`),
  ].slice(0, 6);

  const lines = [
    '# Project Essence',
    '',
    `This project evolved through ${phases.length || 1} major phase(s).`,
    '',
    '## Key decisions',
    ...keyDecisions.map((d) => `- ${d}`),
    '',
    '## Current focus',
    `- ${currentFocus}`,
    '',
    '## Recent activity',
    ...events.slice(0, 5).map((e) => `- ${e.timestamp.slice(0, 10)}: ${e.title}`),
    '',
    '## Open risks',
    ...(openRisks.length ? openRisks.map((r) => `- ${r}`) : ['- None flagged']),
    '',
    `Cognitive health: ${health.score}%`,
  ];

  return {
    phases,
    key_decisions: keyDecisions,
    current_focus: currentFocus,
    open_risks: openRisks,
    formatted_markdown: lines.join('\n'),
  };
}
