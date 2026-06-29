import { readStateJson } from '../../bootstrap/bootstrapState.js';
import { readIntentNodesVNext } from '../../intelligence/intentVNext.js';
import { readHandoffArtifact } from '../../understanding/store.js';
import { deriveNextActions } from '../actionEngine.js';
import { getDecisionCenter } from '../decisionCenter.js';
import { readAllCognitiveEvents } from '../eventStore.js';
import { detectProjectDrift } from '../pik/drift.js';
import type { DriftReport, ProjectIntentKernel } from '../pik/types.js';
import { isDirectionQuery, isDriftQuery } from './directionQuery.js';

export interface FusedSemanticContext {
  project_core_direction: string;
  primary_intent_statement: string;
  current_alignment_score: number;
  drift: DriftReport;
  goal_hierarchy: Array<{ goal: string; weight: number }>;
  current_focus?: string;
  recommended_next_focus: string[];
  reasoning_trace: string[];
  sources: string[];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/[^\w]+/).filter((t) => t.length > 3));
  const tb = new Set(b.toLowerCase().split(/[^\w]+/).filter((t) => t.length > 3));
  if (ta.size === 0 || tb.size === 0) {
    return 0;
  }
  let hit = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      hit += 1;
    }
  }
  return hit / Math.max(ta.size, tb.size);
}

export async function fuseSemanticContext(
  workspaceRoot: string,
  question: string,
  pik: ProjectIntentKernel,
): Promise<FusedSemanticContext> {
  const trace: string[] = ['load_pik'];
  const sources = ['.contora/intent/kernel.json (PIK)'];

  const [state, handoff, intents, events, center, actions] = await Promise.all([
    readStateJson(workspaceRoot),
    readHandoffArtifact(workspaceRoot),
    readIntentNodesVNext(workspaceRoot),
    readAllCognitiveEvents(workspaceRoot),
    getDecisionCenter(workspaceRoot),
    deriveNextActions(workspaceRoot),
  ]);

  sources.push(
    '.contora/state.json',
    '.contora/understanding/handoff.json',
    '.contora/intelligence/intent_nodes.json',
    '.contora/cognitive/events/',
    '.contora/cognitive/adrs/',
  );

  trace.push('merge_pil_cil');
  const currentFocus =
    handoff?.current_focus?.trim() || state?.currentTask?.trim() || handoff?.goal?.trim() || undefined;

  const drift = await detectProjectDrift(workspaceRoot, pik);
  trace.push('drift_detection');

  const alignFocus = currentFocus ? tokenOverlap(currentFocus, pik.primary_intent.statement) : 0.5;
  const alignGoals =
    pik.goal_hierarchy.length > 0
      ? pik.goal_hierarchy.reduce((s, g) => s + g.weight * (currentFocus ? tokenOverlap(currentFocus, g.goal) : 0.5), 0)
      : 0.5;
  const current_alignment_score = clamp01(1 - drift.drift_score * 0.6 + alignFocus * 0.25 + alignGoals * 0.15);

  const recommended_next_focus = actions.slice(0, 4).map((a) => a.task);

  const project_core_direction = [
    pik.primary_intent.statement,
    pik.goal_hierarchy.length
      ? `Goals: ${pik.goal_hierarchy
          .slice(0, 3)
          .map((g) => g.goal)
          .join(' · ')}`
      : '',
    currentFocus ? `Current focus: ${currentFocus}` : '',
    intents[0]?.title ? `Intent node: ${intents[0].title}` : '',
    center.decisions[0]?.title ? `Latest decision: ${center.decisions[0].title}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (isDirectionQuery(question)) {
    trace.push('direction_query_pik_priority');
  }
  if (isDriftQuery(question)) {
    trace.push('drift_query');
  }
  if (events.length) {
    trace.push(`events:${events.length}`);
  }

  return {
    project_core_direction,
    primary_intent_statement: pik.primary_intent.statement,
    current_alignment_score,
    drift,
    goal_hierarchy: pik.goal_hierarchy,
    current_focus: currentFocus,
    recommended_next_focus,
    reasoning_trace: trace,
    sources: [...new Set(sources)],
  };
}
