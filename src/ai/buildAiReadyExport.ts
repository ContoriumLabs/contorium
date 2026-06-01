import type { EventStore } from '../core/engine/eventStore';
import type { ProjectState } from '../types/state';
import type { ActivityAnalysis } from '../core/semantic/activityAnalyzer';
import { extractTaskAnchor } from '../state-engine';
import {
  buildLightInsights,
  formatWorkingContextMarkdown,
  purifySnapshotMarkdown,
} from './exportConvergence';
import { filterEngineeringPaths } from '../ui/sidebarPathFilter';
import { buildActivityStreamItems } from '../ui/sidebarViewModel';
import type { StateSummary } from '../intelligence/types';

/** v2.1 converged export — 4 layers + notes/instruction (no inferred-behavior stack). */
export interface AiReadyJsonExport {
  taskAnchor: string;
  projectSnapshot?: string;
  workingContext: {
    activeFiles: string[];
    recentWork: string[];
  };
  insights?: string[];
  notes: string;
  instruction: string;
}

function basenameOf(rel: string): string {
  const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : rel;
}

function isLowValueBasename(rel: string): boolean {
  const base = basenameOf(rel);
  const nameNoExt = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
  if (/\.(tmp|log|cache)$/i.test(base)) {
    return true;
  }
  if (/^test/i.test(base) || /^temp/i.test(base)) {
    return true;
  }
  if (/^\d+$/.test(nameNoExt) || /^\d{4,}/.test(nameNoExt)) {
    return true;
  }
  return false;
}

function computePathScore(
  path: string,
  analysis: ActivityAnalysis,
  openSet: Set<string>,
  gitSet: Set<string>,
): number {
  const f = analysis.focusByFile[path] ?? 0;
  const s = analysis.saveByFile[path] ?? 0;
  const open = openSet.has(path) ? 1 : 0;
  const git = gitSet.has(path) ? 1 : 0;
  return f * 0.5 + s * 3 + open * 2 + git * 4;
}

function pickActiveFileBasenames(
  state: ProjectState,
  analysis: ActivityAnalysis,
  shouldIgnore: ((p: string) => boolean) | undefined,
  max: number,
): string[] {
  const openSet = new Set((state.openFiles ?? []).filter((p) => p && !shouldIgnore?.(p)));
  const gitSet = new Set(
    [...(state.gitStaged ?? []), ...(state.gitWorking ?? [])].filter((p) => p && !shouldIgnore?.(p)),
  );
  const paths = new Set<string>();
  for (const p of state.recentFiles ?? []) {
    if (p) paths.add(p.replace(/\\/g, '/'));
  }
  for (const p of state.openFiles ?? []) {
    if (p) paths.add(p.replace(/\\/g, '/'));
  }
  for (const k of Object.keys(analysis.fileActivity)) {
    paths.add(k.replace(/\\/g, '/'));
  }
  const filtered = filterEngineeringPaths([...paths]).filter((p) => !shouldIgnore?.(p));
  const rows = filtered
    .map((p) => {
      const rawAct = analysis.fileActivity[p] ?? 0;
      const score = computePathScore(p, analysis, openSet, gitSet);
      return { p, score, rawAct };
    })
    .filter((x) => !isLowValueBasename(x.p))
    .filter((x) => {
      if (openSet.has(x.p) || gitSet.has(x.p)) {
        return x.score >= 1;
      }
      return x.rawAct >= 3 || x.score >= 3;
    })
    .sort((a, b) => b.score - a.score || a.p.localeCompare(b.p));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const b = basenameOf(r.p);
    if (seen.has(b)) {
      continue;
    }
    seen.add(b);
    out.push(b);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

function pickRecentWorkLines(eventStore: EventStore | undefined, max: number): string[] {
  if (!eventStore) {
    return [];
  }
  const raw = buildActivityStreamItems(eventStore, Math.max(max * 2, 8));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of raw) {
    if (seen.has(line)) {
      continue;
    }
    seen.add(line);
    out.push(line);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

export function buildAiReadyJsonExport(args: {
  state: ProjectState;
  eventStore: EventStore | undefined;
  analysis: ActivityAnalysis;
  instruction: string;
  shouldIgnore?: (p: string) => boolean;
  projectSnapshot?: string;
  summary?: StateSummary;
}): AiReadyJsonExport {
  const { state, eventStore, analysis, instruction, shouldIgnore, projectSnapshot, summary } = args;
  const taskAnchor = extractTaskAnchor(state);
  const active = pickActiveFileBasenames(state, analysis, shouldIgnore, 5);
  const recent = pickRecentWorkLines(eventStore, 5);
  const notes = (state.notes ?? '').trim();
  const insights = buildLightInsights(summary, taskAnchor);

  const out: AiReadyJsonExport = {
    taskAnchor: taskAnchor || '(not set)',
    workingContext: {
      activeFiles: active.length ? active : ['(none above threshold)'],
      recentWork: recent.length ? recent : ['(no recent edits in buffer)'],
    },
    notes: notes || '(none)',
    instruction: instruction.trim() || '(none)',
  };
  if (projectSnapshot?.trim()) {
    out.projectSnapshot = purifySnapshotMarkdown(projectSnapshot, summary);
  }
  if (insights.length) {
    out.insights = insights;
  }
  return out;
}

/**
 * v2.1 converged markdown:
 * TASK ANCHOR → PROJECT SNAPSHOT (pure) → WORKING CONTEXT → INSIGHTS → NOTES → INSTRUCTION
 */
export function buildAiReadyMarkdownExport(args: {
  state: ProjectState;
  eventStore: EventStore | undefined;
  analysis: ActivityAnalysis;
  instruction: string;
  shouldIgnore?: (p: string) => boolean;
  projectSnapshot?: string;
  summary?: StateSummary;
}): string {
  const j = buildAiReadyJsonExport(args);
  const lines: string[] = [];

  lines.push('# TASK ANCHOR');
  lines.push(j.taskAnchor);
  lines.push('');

  if (j.projectSnapshot) {
    lines.push('# PROJECT SNAPSHOT');
    lines.push(j.projectSnapshot);
    lines.push('');
  }

  lines.push('# WORKING CONTEXT');
  lines.push(formatWorkingContextMarkdown(j.workingContext.activeFiles, j.workingContext.recentWork));
  lines.push('');

  if (j.insights?.length) {
    lines.push('# INSIGHTS');
    lines.push(j.insights.map((s) => `- ${s}`).join('\n'));
    lines.push('');
  }

  if (j.notes !== '(none)') {
    lines.push('# NOTES');
    lines.push(j.notes);
    lines.push('');
  }

  lines.push('# INSTRUCTION');
  lines.push(j.instruction);
  lines.push('');

  return lines.join('\n');
}
