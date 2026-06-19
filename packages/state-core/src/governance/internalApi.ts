import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readHandoffArtifact } from '../understanding/store.js';
import { syncCognitiveLayer } from './cognitiveProjection.js';
import { updateCognitiveFromInput } from './cognitiveLoop.js';
import { preActionCheck } from './executionGuard.js';
import { getGovernanceSummary, loadGovernanceBundle } from './governanceEngine.js';
import {
  readCognitiveIntent,
  readCognitiveState,
  readChangeLog,
} from './store.js';
import type { ExecutionGuardResult, PreActionCheckInput } from './types.js';

/** V3.2 internal API — not HTTP; shared by MCP / CLI / IDE adapters. */

export async function analyzeProject(workspaceRoot: string): Promise<{
  workspaceRoot: string;
  governance: Awaited<ReturnType<typeof getGovernanceSummary>>;
  cognitive: {
    state: Awaited<ReturnType<typeof readCognitiveState>>;
    intent: Awaited<ReturnType<typeof readCognitiveIntent>>;
  };
  handoff: {
    goal?: string;
    current_focus?: string;
    risk?: string;
  };
}> {
  const resolved = workspaceRoot;
  const [governance, state, intent, handoff] = await Promise.all([
    getGovernanceSummary(resolved),
    readCognitiveState(resolved),
    readCognitiveIntent(resolved),
    readHandoffArtifact(resolved),
  ]);
  return {
    workspaceRoot: resolved,
    governance,
    cognitive: { state, intent },
    handoff: {
      goal: handoff?.goal,
      current_focus: handoff?.current_focus,
      risk: handoff?.impact_summary?.risk,
    },
  };
}

export async function validateChange(
  workspaceRoot: string,
  input: PreActionCheckInput,
): Promise<ExecutionGuardResult> {
  return preActionCheck(workspaceRoot, input);
}

export async function getProjectState(workspaceRoot: string): Promise<{
  workspaceRoot: string;
  bootstrap: Awaited<ReturnType<typeof readStateJson>>;
  cognitive: Awaited<ReturnType<typeof readCognitiveState>>;
  intent: Awaited<ReturnType<typeof readCognitiveIntent>>;
  governance_ready: boolean;
  recent_guard_checks: number;
}> {
  const [bootstrap, cognitive, intent, bundle, changeLog] = await Promise.all([
    readStateJson(workspaceRoot),
    readCognitiveState(workspaceRoot),
    readCognitiveIntent(workspaceRoot),
    loadGovernanceBundle(workspaceRoot),
    readChangeLog(workspaceRoot),
  ]);
  return {
    workspaceRoot,
    bootstrap,
    cognitive,
    intent,
    governance_ready: !!bundle,
    recent_guard_checks: changeLog?.records?.length ?? 0,
  };
}

export async function refreshProjectCognitive(workspaceRoot: string): Promise<void> {
  const state = await readStateJson(workspaceRoot);
  await syncCognitiveLayer(workspaceRoot, state);
}

export { updateCognitiveFromInput, preActionCheck };
