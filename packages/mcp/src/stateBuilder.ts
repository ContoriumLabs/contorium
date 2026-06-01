import * as fs from 'node:fs/promises';
import { projectSnapshotFile, projectStateFile } from './paths.js';

export interface McpProjectBuiltState {
  version: number;
  engine_version?: number;
  generatedAt: number;
  task_anchor?: string;
  project_goal: string;
  current_stage: string;
  active_modules: string[];
  recent_decisions: string[];
  open_problems: string[];
  completed_milestones: string[];
  next_actions: string[];
  confidence: number;
}

export async function loadProjectBuiltState(workspaceRoot: string): Promise<McpProjectBuiltState | null> {
  const fp = projectStateFile(workspaceRoot);
  try {
    const text = await fs.readFile(fp, 'utf8');
    const o = JSON.parse(text) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || o.version !== 1) {
      return null;
    }
    const strList = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    return {
      version: 1,
      engine_version: typeof o.engine_version === 'number' ? o.engine_version : undefined,
      generatedAt: typeof o.generatedAt === 'number' ? o.generatedAt : 0,
      task_anchor: typeof o.task_anchor === 'string' ? o.task_anchor : undefined,
      project_goal: typeof o.project_goal === 'string' ? o.project_goal : '',
      current_stage: typeof o.current_stage === 'string' ? o.current_stage : '',
      active_modules: strList(o.active_modules),
      recent_decisions: strList(o.recent_decisions),
      open_problems: strList(o.open_problems),
      completed_milestones: strList(o.completed_milestones),
      next_actions: strList(o.next_actions),
      confidence: typeof o.confidence === 'number' ? o.confidence : 0,
    };
  } catch {
    return null;
  }
}

export async function loadProjectSnapshotMarkdown(workspaceRoot: string): Promise<string | null> {
  const fp = projectSnapshotFile(workspaceRoot);
  try {
    const text = (await fs.readFile(fp, 'utf8')).trim();
    return text.length ? text : null;
  } catch {
    return null;
  }
}
