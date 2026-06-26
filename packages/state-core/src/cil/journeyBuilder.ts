import { readEvolutionGraph } from '../intelligence/systems/evolutionGraph.js';
import { readProjectIdentity } from '../intelligence/projectIdentity.js';
import type { ProjectJourneyStage } from './types.js';
import { readAllCognitiveEvents } from './eventStore.js';

const DEFAULT_JOURNEY: ProjectJourneyStage[] = [
  { version: 'V1', label: 'Workspace Memory', summary: 'Persistent focus and notes in IDE' },
  { version: 'V2', label: 'Project Snapshot', summary: 'Shared workspace state across tools' },
  { version: 'V3', label: 'AI PIL', summary: 'Structured project intelligence layer' },
  { version: 'V4', label: 'Cognitive Interaction', summary: 'Ask · History · Decisions · Impact' },
];

export async function buildProjectJourney(workspaceRoot: string): Promise<{
  stages: ProjectJourneyStage[];
  formatted: string[];
}> {
  const [evolution, identity, events] = await Promise.all([
    readEvolutionGraph(workspaceRoot),
    readProjectIdentity(workspaceRoot),
    readAllCognitiveEvents(workspaceRoot),
  ]);

  let stages = DEFAULT_JOURNEY;

  if (evolution?.chains?.length) {
    stages = evolution.chains.slice(0, 6).map((chain, i) => ({
      version: `Stage ${i + 1}`,
      label: chain.topic || chain.chain_id || `Evolution ${i + 1}`,
      summary: chain.nodes?.[chain.nodes.length - 1]?.stage || 'Project evolution milestone',
    }));
  }

  const formatted: string[] = ['Project Journey', ''];
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i]!;
    formatted.push(s.version, '', s.label, '', s.summary, '');
    if (i < stages.length - 1) {
      formatted.push('↓', '');
    }
  }

  if (identity?.runtime_version) {
    formatted.push(`Runtime: ${identity.runtime_version}`, `Events recorded: ${events.length}`, '');
  }

  return { stages, formatted };
}
