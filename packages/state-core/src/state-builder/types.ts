/** State Builder — AI-agnostic project state (`.contora/state-builder/project-state.json`). */

export interface ProjectBuiltState {
  version: 1;
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

export const PROJECT_BUILT_STATE_VERSION = 1 as const;

export function emptyProjectBuiltState(now = Date.now()): ProjectBuiltState {
  return {
    version: PROJECT_BUILT_STATE_VERSION,
    generatedAt: now,
    project_goal: '',
    current_stage: '',
    active_modules: [],
    recent_decisions: [],
    open_problems: [],
    completed_milestones: [],
    next_actions: [],
    confidence: 0,
  };
}
