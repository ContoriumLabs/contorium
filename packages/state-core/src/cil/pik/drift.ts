import { readStateJson } from '../../bootstrap/bootstrapState.js';
import { readHandoffArtifact } from '../../understanding/store.js';
import { readAllCognitiveEvents } from '../eventStore.js';
import type { DriftReport, DriftSeverity, DriftType, ProjectIntentKernel } from './types.js';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) {
    return 0;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function severityFromScore(score: number): DriftSeverity {
  if (score < 0.2) {
    return 'LOW';
  }
  if (score < 0.5) {
    return 'MEDIUM';
  }
  return 'HIGH';
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\w]+/)
      .filter((t) => t.length > 3),
  );
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let hit = 0;
  for (const t of a) {
    if (b.has(t)) {
      hit += 1;
    }
  }
  return hit / Math.max(a.size, b.size);
}

function buildGoalVector(pik: ProjectIntentKernel): number[] {
  const b = pik.semantic_bias;
  return [b.memory, b.reasoning, b.execution, pik.primary_intent.confidence];
}

function buildCurrentVector(
  focus: string,
  recentTitles: string[],
  pik: ProjectIntentKernel,
): number[] {
  const goalTokens = tokenSet(
    [pik.primary_intent.statement, ...pik.goal_hierarchy.map((g) => g.goal)].join(' '),
  );
  const currentTokens = tokenSet([focus, ...recentTitles].join(' '));
  const align = overlapRatio(goalTokens, currentTokens);
  const b = pik.semantic_bias;
  return [b.memory * align, b.reasoning * align, b.execution * align, align];
}

function classifyDriftType(focus: string, recentTitles: string[], pik: ProjectIntentKernel): DriftType {
  const goalText = pik.primary_intent.statement.toLowerCase();
  const focusLower = focus.toLowerCase();
  if (focus && !focusLower.includes(goalText.slice(0, Math.min(12, goalText.length))) && goalText.length > 8) {
    return 'intent';
  }
  const patchy = recentTitles.filter((t) => /fix|bug|patch|refactor|cleanup/i.test(t)).length;
  if (patchy >= 3) {
    return 'behavioral';
  }
  if (recentTitles.length >= 4) {
    const modules = new Set(recentTitles.map((t) => t.split(/[/\\]/)[0]).filter(Boolean));
    if (modules.size >= 4) {
      return 'structural';
    }
  }
  return 'none';
}

export async function detectProjectDrift(
  workspaceRoot: string,
  pik: ProjectIntentKernel,
): Promise<DriftReport> {
  const [state, handoff, events] = await Promise.all([
    readStateJson(workspaceRoot),
    readHandoffArtifact(workspaceRoot),
    readAllCognitiveEvents(workspaceRoot),
  ]);

  const focus =
    handoff?.current_focus?.trim() ||
    state?.currentTask?.trim() ||
    handoff?.goal?.trim() ||
    '';

  const recentTitles = events.slice(0, 8).map((e) => e.title);
  const goalVec = buildGoalVector(pik);
  const currentVec = buildCurrentVector(focus, recentTitles, pik);
  const similarity = cosineSimilarity(goalVec, currentVec);
  const driftScore = clamp01(1 - similarity);

  const driftType = classifyDriftType(focus, recentTitles, pik);
  const severity = severityFromScore(driftScore);

  let explanation = 'Current activity aligns with PIK goals.';
  if (severity === 'MEDIUM') {
    explanation = `Moderate drift (${driftType}): recent work partially diverges from PIK primary intent.`;
  } else if (severity === 'HIGH') {
    explanation = `High drift (${driftType}): current focus "${focus || '—'}" may not match project direction.`;
  }

  return {
    drift_score: driftScore,
    severity,
    drift_type: driftType,
    explanation,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
