import type { ProjectGraph, RiskLevel } from './types.js';
import type { ChangeArtifact } from './types.js';
import type { ImpactAnalysis } from './types.js';

const SENSITIVE_HINTS = /auth|password|token|secret|payment|security|credential|login|session/i;

function moduleOfSymbol(ref: string): string {
  const idx = ref.indexOf('::');
  return idx >= 0 ? ref.slice(0, idx) : ref;
}

function fnNameOfSymbol(ref: string): string {
  const parts = ref.split('::');
  return parts.length >= 2 ? parts[parts.length - 1]! : ref;
}

function inferRisk(affectedCount: number, names: string[]): RiskLevel {
  const sensitive = names.some((n) => SENSITIVE_HINTS.test(n));
  if (sensitive || affectedCount >= 4) {
    return 'high';
  }
  if (affectedCount >= 2) {
    return 'medium';
  }
  return 'low';
}

export function analyzeImpact(graph: ProjectGraph, change: ChangeArtifact): ImpactAnalysis {
  const changedFnNames = new Set(
    change.key_changes.filter((k) => k.kind === 'function').map((k) => fnNameOfSymbol(k.symbol)),
  );
  const changedFnIds = new Set(
    graph.nodes
      .filter((n) => n.kind === 'function' && changedFnNames.has(n.name))
      .map((n) => n.id),
  );

  const callers = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind !== 'calls' || !changedFnIds.has(edge.to)) {
      continue;
    }
    const node = graph.nodes.find((n) => n.id === edge.from);
    if (node?.kind === 'function') {
      callers.add(`${node.file}::${node.name}`);
    }
  }

  const fnChanges = change.key_changes.filter((k) => k.kind === 'function').map((k) => k.symbol);
  const affected_modules = [
    ...new Set([
      ...change.changed_files.map((f) => f.replace(/\\/g, '/')),
      ...[...callers].map(moduleOfSymbol),
    ]),
  ];

  const affected_functions = [...callers];
  const risk = inferRisk(affected_functions.length, [...fnChanges, ...affected_functions]);

  const details: string[] = [];
  if (fnChanges.length) {
    details.push(`Changed functions: ${fnChanges.slice(0, 8).join(', ')}`);
  }
  if (affected_functions.length) {
    details.push(`Direct callers: ${affected_functions.slice(0, 8).join(', ')}`);
  } else if (fnChanges.length) {
    details.push('No direct callers detected in change neighborhood (MVP static scan).');
  }

  return { affected_functions, affected_modules, risk, details };
}
