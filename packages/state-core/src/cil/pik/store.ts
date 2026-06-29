import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { intentDir } from '../../intelligence/paths.js';
import { DEFAULT_PIK, PIK_SCHEMA, type ProjectIntentKernel } from './types.js';

export const PIK_KERNEL_FILE = 'kernel.json';

export function pikKernelPath(workspaceRoot: string): string {
  return path.join(intentDir(workspaceRoot), PIK_KERNEL_FILE);
}

function normalizePik(raw: Partial<ProjectIntentKernel>): ProjectIntentKernel {
  return {
    ...DEFAULT_PIK,
    ...raw,
    schema: PIK_SCHEMA,
    project_identity: { ...DEFAULT_PIK.project_identity, ...raw.project_identity },
    primary_intent: { ...DEFAULT_PIK.primary_intent, ...raw.primary_intent },
    goal_hierarchy: Array.isArray(raw.goal_hierarchy) ? raw.goal_hierarchy : [],
    non_goals: Array.isArray(raw.non_goals) ? raw.non_goals : DEFAULT_PIK.non_goals,
    constraints: Array.isArray(raw.constraints) ? raw.constraints : DEFAULT_PIK.constraints,
    semantic_bias: { ...DEFAULT_PIK.semantic_bias, ...raw.semantic_bias },
    updated_at: raw.updated_at ?? new Date().toISOString(),
    source: raw.source ?? 'derived',
  };
}

export async function readProjectIntentKernel(workspaceRoot: string): Promise<ProjectIntentKernel | null> {
  try {
    const text = await fs.readFile(pikKernelPath(workspaceRoot), 'utf8');
    const raw = JSON.parse(text) as Partial<ProjectIntentKernel>;
    if (raw?.schema !== PIK_SCHEMA) {
      return null;
    }
    return normalizePik(raw);
  } catch {
    return null;
  }
}

export async function writeProjectIntentKernel(
  workspaceRoot: string,
  kernel: ProjectIntentKernel,
): Promise<ProjectIntentKernel> {
  const next = normalizePik({ ...kernel, updated_at: new Date().toISOString() });
  const file = pikKernelPath(workspaceRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}
