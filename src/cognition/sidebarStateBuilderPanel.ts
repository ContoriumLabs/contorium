import type * as vscode from 'vscode';
import { readProjectBuiltState } from '../state-builder/store';
import type { ProjectBuiltState } from '../state-builder/types';

/** Sidebar-facing State Builder panel. */
export interface SidebarProjectStatePanel {
  projectGoal: string;
  currentStage: string;
  activeModules: string[];
  recentDecisions: string[];
  openProblems: string[];
  completedMilestones: string[];
  nextActions: string[];
  confidence: number;
  updatedAt: number;
  empty: boolean;
}

const EMPTY: SidebarProjectStatePanel = {
  projectGoal: '',
  currentStage: '',
  activeModules: [],
  recentDecisions: [],
  openProblems: [],
  completedMilestones: [],
  nextActions: [],
  confidence: 0,
  updatedAt: 0,
  empty: true,
};

export async function buildSidebarProjectStatePanel(
  folder: vscode.WorkspaceFolder,
): Promise<SidebarProjectStatePanel> {
  const built = await readProjectBuiltState(folder);
  if (!built) {
    return { ...EMPTY };
  }
  return mapBuiltToPanel(built);
}

export function mapBuiltToPanel(built: ProjectBuiltState): SidebarProjectStatePanel {
  const hasContent =
    built.project_goal.length > 0 ||
    built.current_stage.length > 0 ||
    built.active_modules.length > 0 ||
    built.next_actions.length > 0;
  return {
    projectGoal: built.project_goal,
    currentStage: built.current_stage,
    activeModules: built.active_modules.slice(0, 8),
    recentDecisions: built.recent_decisions.slice(0, 6),
    openProblems: built.open_problems.slice(0, 5),
    completedMilestones: built.completed_milestones.slice(0, 4),
    nextActions: built.next_actions.slice(0, 5),
    confidence: built.confidence,
    updatedAt: built.generatedAt,
    empty: !hasContent,
  };
}
