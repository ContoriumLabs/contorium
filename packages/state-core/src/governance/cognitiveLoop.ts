import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readStateJson } from '../bootstrap/bootstrapState.js';
import { syncCognitiveLayer } from './cognitiveProjection.js';
import { writeUserRequestOverlay } from './store.js';
import type { CognitiveGraph, CognitiveIntent, ProjectCognitiveState, UserRequestOverlay } from './types.js';

const CONSTRAINT_MARKERS = /\b(must|without|never|low latency|high stability|no breaking|backward compat)/gi;
const GOAL_VERBS = /\b(add|fix|refactor|implement|upgrade|migrate|optimize|build|create|update|remove)\b/i;

function extractGoal(input: string): string {
  const trimmed = input.trim();
  const firstLine = trimmed.split('\n')[0]?.trim() ?? trimmed;
  return firstLine.length > 240 ? `${firstLine.slice(0, 237)}…` : firstLine;
}

function extractConstraints(input: string): string[] {
  const found = new Set<string>();
  for (const match of input.matchAll(CONSTRAINT_MARKERS)) {
    const idx = match.index ?? 0;
    const slice = input.slice(Math.max(0, idx - 20), idx + 60).replace(/\s+/g, ' ').trim();
    if (slice.length > 8) {
      found.add(slice.length > 80 ? `${slice.slice(0, 77)}…` : slice);
    }
  }
  return [...found].slice(0, 6);
}

function inferPhaseFromInput(input: string): string {
  const lower = input.toLowerCase();
  if (/\b(fix|bug|error|broken)\b/.test(lower)) {
    return 'bugfix';
  }
  if (/\b(refactor|cleanup|restructure)\b/.test(lower)) {
    return 'refactoring';
  }
  if (/\b(doc|readme|document)\b/.test(lower)) {
    return 'documentation';
  }
  if (GOAL_VERBS.test(lower)) {
    return 'active_development';
  }
  return 'exploration';
}

function moduleNodesFromInput(input: string, workspaceRoot: string): string[] {
  const nodes = new Set<string>();
  const relPathRe = /(?:packages\/[\w-]+|src\/[\w-]+|docs\/[\w-]+)/g;
  for (const m of input.matchAll(relPathRe)) {
    nodes.add(
      m[0].split('/')[0] === 'packages'
        ? m[0].split('/').slice(0, 2).join('/')
        : (m[0].split('/')[0] ?? m[0]),
    );
  }
  if (nodes.size === 0) {
    nodes.add(path.basename(workspaceRoot));
  }
  return [...nodes].slice(0, 12);
}

export interface CognitiveUpdateResult {
  updated: boolean;
  user_request?: UserRequestOverlay;
  /** Derived projection after sync — read-only snapshot. */
  state?: ProjectCognitiveState;
  intent?: CognitiveIntent;
  graph?: CognitiveGraph;
}

/**
 * Record user intent as overlay only, then rebuild derived cognitive/*.json.
 * V3.1 handoff remains raw execution context; cognitive/ is derived projection.
 */
export async function updateCognitiveFromInput(
  workspaceRoot: string,
  userInput: string,
): Promise<CognitiveUpdateResult> {
  const trimmed = userInput.trim();
  if (!trimmed) {
    return { updated: false };
  }

  const now = Date.now();
  const overlay: UserRequestOverlay = {
    version: 1,
    generatedAt: now,
    goal: extractGoal(trimmed),
    constraints: extractConstraints(trimmed),
    phase_hint: inferPhaseFromInput(trimmed),
    module_hints: moduleNodesFromInput(trimmed, workspaceRoot),
  };

  await writeUserRequestOverlay(workspaceRoot, overlay);
  await appendCognitiveInputLog(workspaceRoot, { ts: now, input: trimmed.slice(0, 500), goal: overlay.goal }).catch(
    () => undefined,
  );

  const bootstrapState = await readStateJson(workspaceRoot);
  await syncCognitiveLayer(workspaceRoot, bootstrapState);

  const { readCognitiveIntent, readCognitiveState, readCognitiveGraph } = await import('./store.js');
  return {
    updated: true,
    user_request: overlay,
    state: await readCognitiveState(workspaceRoot),
    intent: await readCognitiveIntent(workspaceRoot),
    graph: await readCognitiveGraph(workspaceRoot),
  };
}

async function appendCognitiveInputLog(
  workspaceRoot: string,
  entry: Record<string, unknown>,
): Promise<void> {
  const dir = path.join(workspaceRoot, '.contora', 'cognitive');
  await fs.mkdir(dir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  await fs.appendFile(path.join(dir, `inputs-${day}.jsonl`), `${JSON.stringify(entry)}\n`, 'utf8');
}
