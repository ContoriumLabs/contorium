import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readIntentGraphVNext } from '../intelligence/intentVNext.js';
import { readHandoffArtifact } from '../understanding/store.js';
import { computeCognitiveHealth } from './cognitiveHealth.js';
import { readAllAdrRecords } from './eventStore.js';
import type { ProjectDna } from './types.js';

/** Project DNA — stable identity fingerprint for AI handoff. */
export async function buildProjectDna(workspaceRoot: string): Promise<ProjectDna> {
  const [state, intents, handoff, adrs, health] = await Promise.all([
    readStateJson(workspaceRoot),
    readIntentGraphVNext(workspaceRoot),
    readHandoffArtifact(workspaceRoot),
    readAllAdrRecords(workspaceRoot),
    computeCognitiveHealth(workspaceRoot).catch(() => null),
  ]);

  const architecture =
    adrs.find((a) => /mcp|architecture|runtime|first/i.test(a.title))?.title ??
    adrs[0]?.title ??
    'Not recorded';

  const memory = adrs.find((a) => /pil|intelligence|memory|storage/i.test(a.title))?.title ?? 'AI PIL';

  const interaction = 'CIL (Cognitive Interaction Layer)';

  const stateModel =
    adrs.find((a) => /event|snapshot|state engine/i.test(a.title))?.title ?? 'Event-driven projections';

  const goal =
    handoff?.goal?.trim() ||
    intents?.nodes?.[0]?.name ||
    state?.currentTask?.trim() ||
    'Cross-agent project intelligence';

  const formatted = [
    'Project DNA',
    '',
    `Architecture: ${architecture}`,
    `Memory: ${memory}`,
    `Interaction: ${interaction}`,
    `State: ${stateModel}`,
    `Goal: ${goal}`,
    '',
    `Cognitive health: ${health?.score ?? '—'}%`,
  ];

  return {
    architecture,
    memory,
    interaction,
    state: stateModel,
    goal,
    formatted,
    formatted_markdown: [
      '# Project DNA',
      '',
      `- **Architecture:** ${architecture}`,
      `- **Memory:** ${memory}`,
      `- **Interaction:** ${interaction}`,
      `- **State:** ${stateModel}`,
      `- **Goal:** ${goal}`,
      '',
      `Cognitive health: ${health?.score ?? '—'}%`,
    ].join('\n'),
  };
}
