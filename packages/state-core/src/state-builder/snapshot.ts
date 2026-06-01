import type { ProjectBuiltState } from './types.js';

function section(title: string, items: string[], empty = '(none yet)'): string[] {
  const lines: string[] = [title + ':'];
  if (!items.length) {
    lines.push(empty);
    return lines;
  }
  for (const item of items) {
    lines.push(`- ${item}`);
  }
  return lines;
}

/** Human-readable PROJECT SNAPSHOT — shared by IDE, MCP, and CLI. */
export function formatProjectSnapshotMarkdown(state: ProjectBuiltState): string {
  const lines: string[] = ['PROJECT SNAPSHOT', ''];
  lines.push('Goal:');
  lines.push(
    state.project_goal.trim() ||
      '(not inferred from events yet — add README or continue editing)',
  );
  lines.push('');
  lines.push('Current Stage:');
  lines.push(state.current_stage.trim() || '(undetermined)');
  lines.push('');
  lines.push(...section('Active Modules', state.active_modules));
  lines.push('');
  lines.push(...section('Recent Decisions', state.recent_decisions));
  lines.push('');
  lines.push(...section('Open Problems', state.open_problems));
  lines.push('');
  lines.push(...section('Completed Milestones', state.completed_milestones));
  lines.push('');
  lines.push(...section('Next Actions', state.next_actions));
  lines.push('');
  return lines.join('\n');
}

export function projectSnapshotBulletLines(state: ProjectBuiltState): string[] {
  const out: string[] = [];
  if (state.project_goal) {
    out.push(`Goal: ${state.project_goal}`);
  }
  if (state.current_stage) {
    out.push(`Stage: ${state.current_stage}`);
  }
  for (const p of state.open_problems.slice(0, 2)) {
    out.push(`Problem: ${p}`);
  }
  for (const a of state.next_actions.slice(0, 2)) {
    out.push(`Next: ${a}`);
  }
  return out;
}
