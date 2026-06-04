import type { BootstrapStateJson } from '../types.js';
import type { ChangeArtifact, IntentFusion } from './types.js';
import type { ProjectBuiltState } from '../state-builder/types.js';

const DOMAIN_HINTS: Array<{ re: RegExp; label: string }> = [
  { re: /packages\/mcp|\/mcp\//i, label: 'MCP server integration' },
  { re: /packages\/cli|\/cli\//i, label: 'CLI tooling' },
  { re: /packages\/state-core|state-builder|state-core/i, label: 'shared state engine' },
  { re: /extension|sidebar|vscode/i, label: 'IDE extension UI' },
  { re: /test|spec/i, label: 'testing' },
  { re: /docs?\//i, label: 'documentation' },
];

function inferDomainSignals(changedFiles: string[]): string[] {
  const signals: string[] = [];
  for (const file of changedFiles) {
    for (const hint of DOMAIN_HINTS) {
      if (hint.re.test(file) && !signals.includes(hint.label)) {
        signals.push(hint.label);
      }
    }
  }
  return signals;
}

export function fuseIntent(args: {
  state: BootstrapStateJson;
  change: ChangeArtifact;
  built?: ProjectBuiltState | null;
}): IntentFusion {
  const signals = inferDomainSignals(args.change.changed_files);
  const goal = args.built?.project_goal?.trim() || args.state.currentTask.trim();
  const stage = args.built?.current_stage?.trim();

  let focus = goal || 'Continue current workspace task';
  if (signals.length) {
    focus = `${focus} — focus: ${signals.slice(0, 3).join(', ')}`;
  } else if (args.change.changed_files.length) {
    const top = args.change.changed_files[0]!.split('/').pop() ?? args.change.changed_files[0]!;
    focus = `${focus} — editing ${top}`;
  }
  if (stage) {
    signals.push(`stage: ${stage}`);
  }

  let confidence = 0.45;
  if (goal) {
    confidence += 0.2;
  }
  if (signals.length) {
    confidence += Math.min(0.25, signals.length * 0.08);
  }
  if (args.change.key_changes.length) {
    confidence += 0.1;
  }
  confidence = Math.min(0.92, confidence);

  return {
    focus,
    confidence: Math.round(confidence * 100) / 100,
    signals,
  };
}
