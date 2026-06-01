import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { formatProjectSnapshotMarkdown } from './snapshot.js';
import { PROJECT_BUILT_STATE_VERSION, type ProjectBuiltState } from './types.js';

const BUILDER_REL = ['.contora', 'state-builder'] as const;

export function builderDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, ...BUILDER_REL);
}

export function parseProjectBuiltState(raw: unknown): ProjectBuiltState | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== PROJECT_BUILT_STATE_VERSION) {
    return undefined;
  }
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    version: PROJECT_BUILT_STATE_VERSION,
    generatedAt: typeof o.generatedAt === 'number' ? o.generatedAt : Date.now(),
    task_anchor: typeof o.task_anchor === 'string' ? o.task_anchor : undefined,
    engine_version: typeof o.engine_version === 'number' ? o.engine_version : undefined,
    project_goal: typeof o.project_goal === 'string' ? o.project_goal : '',
    current_stage: typeof o.current_stage === 'string' ? o.current_stage : '',
    active_modules: strList(o.active_modules),
    recent_decisions: strList(o.recent_decisions),
    open_problems: strList(o.open_problems),
    completed_milestones: strList(o.completed_milestones),
    next_actions: strList(o.next_actions),
    confidence: typeof o.confidence === 'number' ? o.confidence : 0,
  };
}

export async function readProjectBuiltState(workspaceRoot: string): Promise<ProjectBuiltState | undefined> {
  try {
    const text = await fs.readFile(path.join(builderDir(workspaceRoot), 'project-state.json'), 'utf8');
    return parseProjectBuiltState(JSON.parse(text));
  } catch {
    return undefined;
  }
}

export async function readProjectSnapshotMarkdown(workspaceRoot: string): Promise<string | undefined> {
  try {
    const text = (await fs.readFile(path.join(builderDir(workspaceRoot), 'project-snapshot.md'), 'utf8')).trim();
    return text.length ? text : undefined;
  } catch {
    return undefined;
  }
}

export async function writeProjectBuiltState(
  workspaceRoot: string,
  built: ProjectBuiltState,
  snapshotMarkdown?: string,
): Promise<void> {
  const dir = builderDir(workspaceRoot);
  await fs.mkdir(dir, { recursive: true });
  const md = snapshotMarkdown ?? formatProjectSnapshotMarkdown(built);
  await Promise.all([
    fs.writeFile(path.join(dir, 'project-state.json'), JSON.stringify(built, null, 2), 'utf8'),
    fs.writeFile(path.join(dir, 'project-snapshot.md'), md, 'utf8'),
  ]);
}
