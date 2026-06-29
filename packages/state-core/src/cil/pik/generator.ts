import * as path from 'node:path';
import { readStateJson } from '../../bootstrap/bootstrapState.js';
import { readProjectIdentity } from '../../intelligence/projectIdentity.js';
import { readIntentNodesVNext } from '../../intelligence/intentVNext.js';
import { readHandoffArtifact } from '../../understanding/store.js';
import { readAllAdrRecords } from '../eventStore.js';
import { readProjectIntentKernel, writeProjectIntentKernel } from './store.js';
import type { PikGoal, ProjectIntentKernel } from './types.js';
import { DEFAULT_PIK, PIK_SCHEMA } from './types.js';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function uniqGoals(candidates: Array<{ goal: string; weight: number }>): PikGoal[] {
  const map = new Map<string, number>();
  for (const c of candidates) {
    const g = c.goal.trim();
    if (!g || g.length < 4) {
      continue;
    }
    map.set(g, Math.max(map.get(g) ?? 0, c.weight));
  }
  const sorted = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([goal, weight]) => ({ goal, weight: clamp01(weight) }));
  const total = sorted.reduce((s, g) => s + g.weight, 0) || 1;
  return sorted.map((g) => ({ goal: g.goal, weight: clamp01(g.weight / total) }));
}

/** Derive PIK from PIL/CIL artifacts — goal structure, not event summary. */
export async function generateProjectIntentKernel(workspaceRoot: string): Promise<ProjectIntentKernel> {
  const root = path.resolve(workspaceRoot);
  const [state, handoff, intents, adrs, identity] = await Promise.all([
    readStateJson(root),
    readHandoffArtifact(root),
    readIntentNodesVNext(root),
    readAllAdrRecords(root),
    readProjectIdentity(root),
  ]);

  const projectName = identity?.project_id ?? path.basename(root);
  const focus = handoff?.goal?.trim() || handoff?.current_focus?.trim() || state?.currentTask?.trim() || '';
  const primaryStatement =
    focus ||
    intents[0]?.description?.trim() ||
    intents[0]?.title?.trim() ||
    adrs[0]?.reason?.trim() ||
    'Build and evolve this codebase with traceable project memory';

  const goalCandidates: Array<{ goal: string; weight: number }> = [];
  if (focus) {
    goalCandidates.push({ goal: focus, weight: 0.45 });
  }
  for (const node of intents.slice(0, 4)) {
    const text = node.description?.trim() || node.title?.trim();
    if (text) {
      goalCandidates.push({ goal: text, weight: 0.25 });
    }
  }
  for (const adr of adrs.slice(0, 3)) {
    if (adr.reason?.trim()) {
      goalCandidates.push({ goal: adr.reason.trim(), weight: 0.2 });
    }
  }
  for (const na of handoff?.next_actions?.slice(0, 3) ?? []) {
    const t = na.action?.trim() || na.target?.trim();
    if (t) {
      goalCandidates.push({ goal: t, weight: 0.15 });
    }
  }

  const goal_hierarchy = uniqGoals(goalCandidates);
  if (goal_hierarchy.length === 0) {
    goal_hierarchy.push({ goal: primaryStatement, weight: 1 });
  }

  const constraints = [
    ...new Set([
      ...DEFAULT_PIK.constraints,
      ...(intents[0]?.constraints ?? []),
    ]),
  ].slice(0, 8);

  const kernel: ProjectIntentKernel = {
    schema: PIK_SCHEMA,
    updated_at: new Date().toISOString(),
    source: 'derived',
    project_identity: {
      name: projectName,
      type: identity?.project_id ? 'Project Cognitive Runtime' : 'Software Project',
    },
    primary_intent: {
      statement: primaryStatement,
      confidence: focus ? 0.85 : intents.length ? 0.7 : 0.55,
    },
    goal_hierarchy,
    non_goals: [...DEFAULT_PIK.non_goals],
    constraints,
    semantic_bias: {
      memory: handoff ? 0.35 : 0.3,
      reasoning: adrs.length ? 0.4 : 0.35,
      execution: state?.currentTask ? 0.25 : 0.2,
    },
  };

  return writeProjectIntentKernel(root, kernel);
}

/** Load PIK or derive once when missing / stale focus changed. */
export async function ensureProjectIntentKernel(workspaceRoot: string): Promise<ProjectIntentKernel> {
  const existing = await readProjectIntentKernel(workspaceRoot);
  const state = await readStateJson(workspaceRoot);
  const handoff = await readHandoffArtifact(workspaceRoot);
  const liveFocus = handoff?.goal?.trim() || handoff?.current_focus?.trim() || state?.currentTask?.trim() || '';

  if (!existing) {
    return generateProjectIntentKernel(workspaceRoot);
  }

  if (liveFocus && existing.primary_intent.statement !== liveFocus && existing.source === 'derived') {
    return generateProjectIntentKernel(workspaceRoot);
  }

  return existing;
}
