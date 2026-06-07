import * as path from 'node:path';
import type { AdapterKind } from '../types.js';
import { readStateJson } from '../bootstrap/bootstrapState.js';
import { formatHandoffMarkdown } from './formatHandoff.js';
import { readChangeArtifact, readHandoffArtifact, readProjectTimeline } from './store.js';
import type { ChangeArtifact, HandoffArtifact, KeyChange, ProjectTimeline } from './types.js';

/** Contorium Handoff Protocol v1 — shared AI state shape. */
export const CHP_VERSION = 1 as const;

export interface ChpRecentChange {
  type: 'function_update' | 'class_update' | 'file_update';
  name: string;
  file?: string;
  timestamp?: string;
  change_type?: KeyChange['change_type'];
}

export interface ChpAgentContext {
  active_agent: string;
  last_action: string;
}

export interface ChpHandoffState {
  version: typeof CHP_VERSION;
  project: string;
  workspace_root: string;
  current_task: string;
  goal: string;
  recent_changes: ChpRecentChange[];
  agent_context: ChpAgentContext;
  summary: string;
  last_updated: string;
}

export type ChpHandoffFormat = 'json' | 'markdown' | 'compact';

export interface BuildChpHandoffInput {
  workspaceRoot: string;
  handoff?: HandoffArtifact | null;
  change?: ChangeArtifact | null;
  currentTask?: string;
  lastWriter?: AdapterKind | string;
}

function projectName(workspaceRoot: string): string {
  return path.basename(path.resolve(workspaceRoot)) || 'project';
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString();
}

function mapKeyChange(kc: KeyChange): ChpRecentChange {
  const type =
    kc.kind === 'function'
      ? 'function_update'
      : kc.kind === 'class'
        ? 'class_update'
        : 'file_update';
  const name = kc.kind === 'function' ? `${kc.symbol}()` : kc.symbol;
  return { type, name, change_type: kc.change_type };
}

function lastChangeLabel(changes: ChpRecentChange[]): string {
  if (!changes.length) {
    return '—';
  }
  return changes[0]!.name;
}

function lastActionFromChanges(changes: ChpRecentChange[]): string {
  if (!changes.length) {
    return 'idle';
  }
  const first = changes[0]!;
  switch (first.change_type) {
    case 'added':
      return `add_${first.type.replace('_update', '')}`;
    case 'removed':
      return `remove_${first.type.replace('_update', '')}`;
    case 'modified':
      return `modify_${first.type.replace('_update', '')}`;
    default:
      return first.type;
  }
}

/** Build CHP v1 from in-memory runtime slices (sync — dashboard / IDE status bar). */
export function buildChpHandoffStateSync(input: BuildChpHandoffInput): ChpHandoffState | null {
  const root = path.resolve(input.workspaceRoot);
  const handoff = input.handoff ?? null;
  const change = input.change ?? null;
  const currentTask =
    input.currentTask?.trim() ||
    handoff?.current_focus?.trim() ||
    '';
  const lastWriter = input.lastWriter ?? 'runtime';

  const keyChanges = handoff?.key_changes?.length
    ? handoff.key_changes
    : change?.key_changes ?? [];
  const recentChanges = keyChanges.slice(0, 8).map(mapKeyChange);

  if (!handoff && !currentTask && !recentChanges.length) {
    return null;
  }

  const generatedAt = handoff?.generatedAt ?? change?.generatedAt ?? Date.now();

  return {
    version: CHP_VERSION,
    project: projectName(root),
    workspace_root: root,
    current_task: currentTask || handoff?.current_focus?.trim() || '(not set)',
    goal: handoff?.goal?.trim() || currentTask || '(not set)',
    recent_changes: recentChanges,
    agent_context: {
      active_agent: String(lastWriter),
      last_action: lastActionFromChanges(recentChanges),
    },
    summary: handoff?.summary?.trim() || 'No handoff summary yet.',
    last_updated: isoTime(generatedAt),
  };
}

/** Build CHP v1 state from runtime artifacts (single read model). */
export async function buildChpHandoffState(
  input: BuildChpHandoffInput,
): Promise<ChpHandoffState | null> {
  const root = path.resolve(input.workspaceRoot);
  const [handoff, change, state] = await Promise.all([
    input.handoff !== undefined ? Promise.resolve(input.handoff) : readHandoffArtifact(root),
    input.change !== undefined ? Promise.resolve(input.change) : readChangeArtifact(root),
    readStateJson(root),
  ]);

  return buildChpHandoffStateSync({
    workspaceRoot: root,
    handoff,
    change,
    currentTask: input.currentTask?.trim() || state?.currentTask?.trim(),
    lastWriter: input.lastWriter ?? state?.source?.lastWriter,
  });
}

/** CHP compact one-liner for Passive CLI / IDE status bar. */
export function formatChpCompact(state: ChpHandoffState, filter?: string): string {
  const task = truncatePlain(state.current_task, 36);
  const last = truncatePlain(lastChangeLabel(state.recent_changes), 28);
  const agent = state.agent_context.active_agent;
  const filterNote = filter?.trim() ? ` · filter:${filter.trim()}` : '';
  return `[Contorium] task: ${task} | last: ${last} | agent: ${agent}${filterNote}`;
}

function truncatePlain(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** CHP markdown — AI chat injection (wraps V3.1 handoff block when available). */
export function formatChpMarkdown(
  chp: ChpHandoffState,
  handoff?: HandoffArtifact | null,
  timeline?: ProjectTimeline,
): string {
  if (handoff) {
    const base = formatHandoffMarkdown(handoff, timeline);
    const header = [
      `# Project: ${chp.project}`,
      `Current Task: ${chp.current_task}`,
      `Agent: ${chp.agent_context.active_agent} · last action: ${chp.agent_context.last_action}`,
      '',
    ].join('\n');
    return `${header}${base}`;
  }

  const lines = [
    `# Project: ${chp.project}`,
    '',
    `Current Task: ${chp.current_task}`,
    `Goal: ${chp.goal}`,
    '',
    'Recent Changes:',
  ];
  if (chp.recent_changes.length) {
    for (const c of chp.recent_changes.slice(0, 8)) {
      lines.push(`- ${c.name}${c.change_type ? ` (${c.change_type})` : ''}`);
    }
  } else {
    lines.push('- (none)');
  }
  lines.push('');
  lines.push('Agent Context:');
  lines.push(`- active: ${chp.agent_context.active_agent}`);
  lines.push(`- last action: ${chp.agent_context.last_action}`);
  lines.push('');
  lines.push('Summary:');
  lines.push(chp.summary);
  lines.push('');
  return lines.join('\n');
}

/** Unified get_handoff — read runtime artifacts and format. */
export async function getProjectHandoff(
  workspaceRoot: string,
  format: ChpHandoffFormat = 'compact',
  filter?: string,
): Promise<{ found: boolean; text?: string; state?: ChpHandoffState }> {
  const root = path.resolve(workspaceRoot);
  const [chp, handoff, timeline] = await Promise.all([
    buildChpHandoffState({ workspaceRoot: root }),
    readHandoffArtifact(root),
    readProjectTimeline(root),
  ]);

  if (!chp) {
    return { found: false };
  }

  const filtered = filter?.trim()
    ? {
        ...chp,
        recent_changes: chp.recent_changes.filter((c) =>
          c.name.toLowerCase().includes(filter.trim().toLowerCase()),
        ),
      }
    : chp;

  switch (format) {
    case 'json':
      return { found: true, state: filtered, text: JSON.stringify(filtered, null, 2) };
    case 'markdown':
      return {
        found: true,
        state: filtered,
        text: formatChpMarkdown(filtered, handoff, timeline),
      };
    default:
      return { found: true, state: filtered, text: formatChpCompact(filtered, filter) };
  }
}
