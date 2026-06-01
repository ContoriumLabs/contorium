import type { ProjectBuiltState } from '../state-builder/types';
import type { StateConflict, StateConflictSource, StateConflictType } from './types';
import { parseSourceFromTaggedLine, stripSourceSuffix } from './sourcing';

/** Known opposing technology / approach pairs for decision/goal conflict heuristics. */
const OPPOSING_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['funasr', 'sherpa'],
  ['funasr', 'whisper'],
  ['react', 'vue'],
  ['vue', 'angular'],
  ['postgres', 'mysql'],
  ['mysql', 'sqlite'],
  ['redis', 'memcached'],
  ['webpack', 'vite'],
  ['jest', 'mocha'],
  ['rest', 'graphql'],
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function containsTerm(text: string, term: string): boolean {
  const t = norm(text);
  const termNorm = norm(term);
  return t.includes(termNorm);
}

function findOpposingTerms(text: string): string[] {
  const hits = new Set<string>();
  for (const [a, b] of OPPOSING_PAIRS) {
    if (containsTerm(text, a)) {
      hits.add(a);
    }
    if (containsTerm(text, b)) {
      hits.add(b);
    }
  }
  return [...hits];
}

function opposingPairInTexts(texts: readonly string[]): [string, string] | undefined {
  const allTerms = new Set<string>();
  for (const t of texts) {
    for (const term of findOpposingTerms(t)) {
      allTerms.add(term);
    }
  }
  for (const [a, b] of OPPOSING_PAIRS) {
    if (allTerms.has(a) && allTerms.has(b)) {
      return [a, b];
    }
  }
  return undefined;
}

function conflictId(type: StateConflictType, seed: string): string {
  return `conf_${type}_${seed.replace(/\W+/g, '_').slice(0, 40)}_${Date.now().toString(36)}`;
}

function sourcesFromLines(
  lines: readonly string[],
  filter?: (line: string, source: StateConflictSource['source'] | undefined) => boolean,
): StateConflictSource[] {
  const out: StateConflictSource[] = [];
  for (const line of lines) {
    const src = parseSourceFromTaggedLine(line) ?? 'state';
    const detail = stripSourceSuffix(line);
    if (!detail) {
      continue;
    }
    if (filter && !filter(line, src === 'state' ? undefined : src)) {
      continue;
    }
    out.push({ source: src === 'state' ? 'ide' : src, detail });
  }
  return out;
}

function detectDecisionConflicts(
  decisions: readonly string[],
  now: number,
): StateConflict[] {
  const pair = opposingPairInTexts(decisions.map(stripSourceSuffix));
  if (!pair) {
    return [];
  }
  const [a, b] = pair;
  const related = decisions.filter((d) => containsTerm(d, a) || containsTerm(d, b));
  const sources = sourcesFromLines(related);
  if (sources.length < 2) {
    return [];
  }
  const mcpSrc = sources.filter((s) => s.source === 'mcp');
  const ideSrc = sources.filter((s) => s.source !== 'mcp');
  if (mcpSrc.length === 0 || ideSrc.length === 0) {
    return [];
  }
  return [
    {
      id: conflictId('decision', `${a}-${b}`),
      type: 'decision',
      title: 'Decision Conflict',
      sources,
      status: 'UNRESOLVED',
      action: 'Developer review required',
      detectedAt: now,
    },
  ];
}

function detectGoalConflicts(
  normalized: ProjectBuiltState,
  decisions: readonly string[],
  now: number,
): StateConflict[] {
  const goal = normalized.project_goal.trim();
  if (!goal) {
    return [];
  }
  const texts = [goal, ...decisions.map(stripSourceSuffix)];
  const pair = opposingPairInTexts(texts);
  if (!pair) {
    return [];
  }
  const [a, b] = pair;
  const goalSide = containsTerm(goal, a) ? a : containsTerm(goal, b) ? b : '';
  const decSide = decisions.find((d) => {
    const plain = stripSourceSuffix(d);
    return (
      (goalSide === a && containsTerm(plain, b)) ||
      (goalSide === b && containsTerm(plain, a)) ||
      (containsTerm(plain, a) && containsTerm(plain, b))
    );
  });
  if (!goalSide || !decSide) {
    return [];
  }
  const sources: StateConflictSource[] = [
    { source: 'events', detail: goal },
    ...sourcesFromLines([decSide]),
  ];
  return [
    {
      id: conflictId('goal', `${a}-${b}`),
      type: 'goal',
      title: 'Goal Conflict',
      sources,
      status: 'UNRESOLVED',
      action: 'Developer review required',
      detectedAt: now,
    },
  ];
}

function detectModuleConflicts(
  modules: readonly string[],
  ideTopFiles: readonly string[],
  mcpArchitecture: readonly string[],
  now: number,
): StateConflict[] {
  const out: StateConflict[] = [];
  const ideNames = new Set(
    ideTopFiles.map((p) => {
      const n = p.replace(/\\/g, '/');
      return (n.split('/').pop() ?? n).replace(/\.[^.]+$/, '').toLowerCase();
    }),
  );
  for (const arch of mcpArchitecture) {
    const plain = arch.trim();
    if (plain.length < 8) {
      continue;
    }
    for (const mod of modules) {
      const base = stripSourceSuffix(mod).toLowerCase();
      if (base.length < 3) {
        continue;
      }
      if (!ideNames.has(base) && !containsTerm(plain, base)) {
        continue;
      }
      if (/deprecat|replac|migrat|remove|drop|avoid/i.test(plain)) {
        const src = parseSourceFromTaggedLine(mod);
        out.push({
          id: conflictId('module', base),
          type: 'module',
          title: 'Module Conflict',
          sources: [
            { source: 'ide', detail: `Active edits on ${base}` },
            { source: 'mcp', detail: plain },
          ],
          status: 'UNRESOLVED',
          action: 'Developer review required',
          detectedAt: now,
        });
        break;
      }
    }
  }
  return out.slice(0, 3);
}

export interface DetectConflictsInput {
  normalized: ProjectBuiltState;
  mcpDecisions: readonly string[];
  mcpArchitecture: readonly string[];
  ideTopFiles: readonly string[];
  now?: number;
}

/**
 * v2 conflict audit — surfaces UNRESOLVED conflicts only; never picks a winner.
 */
export function detectStateConflicts(input: DetectConflictsInput): StateConflict[] {
  const now = input.now ?? Date.now();
  const decisions = input.normalized.recent_decisions;
  const seen = new Set<string>();
  const merged: StateConflict[] = [];

  for (const c of [
    ...detectDecisionConflicts(decisions, now),
    ...detectGoalConflicts(input.normalized, decisions, now),
    ...detectModuleConflicts(
      input.normalized.active_modules,
      input.ideTopFiles,
      input.mcpArchitecture,
      now,
    ),
  ]) {
    const key = `${c.type}:${c.title}:${c.sources.map((s) => s.detail).join('|')}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(c);
  }
  return merged.slice(0, 8);
}

/** Markdown block for snapshot / export (transparency rule). */
export function formatConflictsMarkdown(conflicts: readonly StateConflict[]): string {
  if (!conflicts.length) {
    return '';
  }
  const lines: string[] = ['⚠ State Conflicts (UNRESOLVED)', ''];
  for (const c of conflicts) {
    lines.push(`Type: ${c.title}`);
    lines.push('Sources:');
    for (const s of c.sources) {
      const label = s.source.toUpperCase();
      lines.push(`- ${label}: ${s.detail}`);
    }
    lines.push(`Status: ${c.status}`);
    lines.push(`Action: ${c.action}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
