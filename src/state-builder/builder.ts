import type { StateSummary } from '../intelligence/types';
import type { WorkspaceEvent } from '../core/models/events';
import type { ProjectState } from '../types/state';
import { rankedFileScores } from '../intelligence/analyzer';
import { deriveTaskOrientedStage } from '../intelligence/domainLabels';
import { deriveNextActionsFromGaps } from '../state-engine/gapAnalysis';
import { formatTaggedList, type TaggedEntry } from '../state-engine';
import type { ProjectBuiltState } from './types';

export interface McpMemoryHint {
  decisions: string[];
  architecture: string[];
  problems: string[];
}

function basenameModule(path: string): string {
  const n = path.replace(/\\/g, '/').trim();
  const base = n.split('/').pop() ?? n;
  return base.replace(/\.(tsx?|jsx?|py|go|rs|md)$/i, '') || base;
}

/** L2 stage — domain task labels only (no vague cluster paths). */
function inferStage(_summary: StateSummary, domains: string[]): string {
  return deriveTaskOrientedStage(domains);
}

function buildTaggedModules(
  rankedPaths: readonly { path: string }[],
  summary: StateSummary,
): string[] {
  const tagged: TaggedEntry[] = [];
  for (const r of rankedPaths.slice(0, 8)) {
    tagged.push({ text: basenameModule(r.path), source: 'ide' });
  }
  for (const f of summary.activity_clusters[0]?.files ?? []) {
    const base = basenameModule(f);
    if (base.length >= 2) {
      tagged.push({ text: base, source: 'events' });
    }
  }
  return formatTaggedList(tagged, 8);
}

function buildTaggedDecisions(
  mcpHints: McpMemoryHint,
  previous?: ProjectBuiltState,
): string[] {
  const tagged: TaggedEntry[] = [];
  for (const d of mcpHints.decisions) {
    tagged.push({ text: d, source: 'mcp' });
  }
  for (const a of mcpHints.architecture.slice(0, 2)) {
    tagged.push({ text: a, source: 'mcp' });
  }
  for (const p of (previous?.recent_decisions ?? []).slice(0, 4)) {
    tagged.push({ text: p.replace(/\s*\(from\s+\w+\)\s*$/i, '').trim(), source: 'ide' });
  }
  return formatTaggedList(tagged, 8);
}

function buildTaggedProblems(
  summary: StateSummary,
  state: ProjectState,
  mcpHints: McpMemoryHint,
): string[] {
  const tagged: TaggedEntry[] = [];
  for (const p of mcpHints.problems) {
    tagged.push({ text: p, source: 'mcp' });
  }
  if (summary.active_problem_area) {
    tagged.push({ text: summary.active_problem_area, source: 'events' });
  }
  const gitCount =
    (state.gitWorking?.length ?? 0) + (state.gitStaged?.length ?? 0);
  if (gitCount >= 8) {
    tagged.push({
      text: `${gitCount} paths with uncommitted changes — integration risk`,
      source: 'git',
    });
  }
  return formatTaggedList(tagged, 6);
}

function inferMilestones(state: ProjectState, events: readonly WorkspaceEvent[]): string[] {
  const tagged: TaggedEntry[] = [];
  const creates = events.filter((e) => e.type === 'file_create').slice(-12);
  for (const ev of creates) {
    if (ev.type === 'file_create') {
      tagged.push({ text: `Created ${basenameModule(ev.file)}`, source: 'ide' });
    }
  }
  if ((state.notes ?? '').trim().length > 12) {
    tagged.push({ text: 'Session notes captured in workspace', source: 'ide' });
  }
  return formatTaggedList(tagged, 5);
}

export interface BuildProjectStateInput {
  state: ProjectState;
  events: readonly WorkspaceEvent[];
  summary: StateSummary;
  readmeHint?: string;
  mcpHints?: McpMemoryHint;
  previous?: ProjectBuiltState;
  now?: number;
}

/** L2 — derive project state from events/facts only (read-only inputs). */
export function buildProjectBuiltState(input: BuildProjectStateInput): ProjectBuiltState {
  const now = input.now ?? Date.now();
  const { state, events, summary } = input;
  const mcpHints = input.mcpHints ?? { decisions: [], architecture: [], problems: [] };
  const ranked = rankedFileScores(events, state, now);
  const modules = buildTaggedModules(ranked, summary);

  let project_goal = summary.project_intent;
  if (!project_goal && input.readmeHint) {
    project_goal = input.readmeHint;
  }

  const domains = summary.active_domains;
  const open_problems = buildTaggedProblems(summary, state, mcpHints);
  const next_actions = deriveNextActionsFromGaps({
    summary,
    openProblems: open_problems,
    activeModules: modules,
    topFilePaths: ranked.slice(0, 6).map((r) => r.path),
  });

  const confidence = Math.min(
    1,
    summary.confidence * 0.5 +
      (project_goal ? 0.2 : 0) +
      (modules.length ? 0.15 : 0) +
      (next_actions.length ? 0.15 : 0),
  );

  return {
    version: 1,
    engine_version: 2,
    generatedAt: now,
    project_goal: project_goal.slice(0, 240),
    current_stage: inferStage(summary, domains),
    active_modules: modules,
    recent_decisions: buildTaggedDecisions(mcpHints, input.previous),
    open_problems,
    completed_milestones: inferMilestones(state, events),
    next_actions,
    confidence: Math.round(confidence * 100) / 100,
  };
}
