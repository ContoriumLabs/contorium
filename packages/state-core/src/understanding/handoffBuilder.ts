import type {
  ChangeArtifact,
  HandoffArtifact,
  HandoffNextAction,
  ImpactAnalysis,
  IntentFusion,
  ProjectGraph,
} from './types.js';
import { UNDERSTANDING_VERSION } from './types.js';
import type { ProjectBuiltState } from '../state-builder/types.js';

function inferAction(text: string): HandoffNextAction['action'] {
  const t = text.toLowerCase();
  if (/fix|bug|error|issue/.test(t)) {
    return 'fix';
  }
  if (/refactor|clean|rename/.test(t)) {
    return 'refactor';
  }
  if (/add|extend|implement|new feature/.test(t)) {
    return 'extend';
  }
  if (/review|check|verify|audit/.test(t)) {
    return 'review';
  }
  return 'continue';
}

function buildNextActions(
  built: ProjectBuiltState | null | undefined,
  impact: ImpactAnalysis,
  goal: string,
): HandoffNextAction[] {
  const fromBuilt = (built?.next_actions ?? [])
    .filter(Boolean)
    .slice(0, 6)
    .map((line) => {
      const trimmed = line.trim();
      return {
        action: inferAction(trimmed),
        target: trimmed,
        reason: '',
      };
    });
  if (fromBuilt.length) {
    return fromBuilt;
  }
  const out: HandoffNextAction[] = [];
  if (impact.risk === 'high') {
    out.push({
      action: 'review',
      target: impact.affected_functions[0] ?? 'changed symbols',
      reason: 'High impact risk detected in change neighborhood',
    });
  }
  if (goal) {
    out.push({ action: 'continue', target: 'project goal', reason: goal });
  } else {
    out.push({
      action: 'review',
      target: 'recent changes',
      reason: 'Review recent changes and continue the current task',
    });
  }
  return out;
}

function graphRefs(graph: ProjectGraph, change: ChangeArtifact): string[] {
  const names = new Set(
    change.key_changes
      .filter((k) => k.kind !== 'file')
      .map((k) => k.symbol.split('::').pop() ?? k.symbol),
  );
  const kindTag = (k: string) => (k === 'class' ? 'cls' : k === 'function' ? 'fn' : k);
  return graph.nodes
    .filter((n) => names.has(n.name))
    .map((n) => `${kindTag(n.kind)}:${n.name}`)
    .slice(0, 12);
}

export function buildHandoff(args: {
  goal: string;
  intent: IntentFusion;
  change: ChangeArtifact;
  impact: ImpactAnalysis;
  graph: ProjectGraph;
  built?: ProjectBuiltState | null;
  now?: number;
}): HandoffArtifact {
  const now = args.now ?? Date.now();
  const next_actions = buildNextActions(args.built, args.impact, args.goal);
  const context_graph_refs = graphRefs(args.graph, args.change);

  const parts: string[] = [];
  if (args.goal) {
    parts.push(`Goal: ${args.goal}`);
  }
  parts.push(`Focus: ${args.intent.focus}`);
  const fnChanges = args.change.key_changes.filter((k) => k.kind === 'function');
  if (fnChanges.length) {
    parts.push(`Changed: ${fnChanges.slice(0, 5).map((k) => k.symbol).join(', ')}`);
  } else if (args.change.changed_files.length) {
    parts.push(`Changed files: ${args.change.changed_files.slice(0, 5).join(', ')}`);
  }
  if (args.impact.affected_functions.length) {
    parts.push(
      `Impact (${args.impact.risk}): ${args.impact.affected_functions.slice(0, 4).join(', ')}`,
    );
  }

  return {
    version: UNDERSTANDING_VERSION,
    generatedAt: now,
    goal: args.goal,
    current_focus: args.intent.focus,
    key_changes: args.change.key_changes,
    impact_summary: {
      risk: args.impact.risk,
      affected_modules: args.impact.affected_modules,
      affected_functions: args.impact.affected_functions,
      details: args.impact.details,
    },
    next_actions,
    context_graph_refs,
    summary: parts.join(' | '),
  };
}
