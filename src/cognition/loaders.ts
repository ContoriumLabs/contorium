import type * as vscode from 'vscode';
import { readStateSummary } from '../intelligence';
import { activeIntentLines, projectUnderstandingLines, readIntentGraph } from '../intent-graph';
import { readProjectSnapshotMarkdown } from '../state-builder/store';
import {
  extractTaskAnchor,
  filterWeakInferenceLines,
  formatConflictsMarkdown,
  readConflictsArtifact,
} from '../state-engine';
import type { StateConflict } from '../state-engine/types';
import type { StateSummary } from '../intelligence/types';
import type { IntentGraph } from '../intent-graph/types';
import type { ProjectState } from '../types/state';

export interface CognitionExportContext {
  summary?: StateSummary;
  graph?: IntentGraph;
  /** L4 — normalized PROJECT SNAPSHOT markdown */
  projectSnapshot?: string;
  /** v2 — unresolved state conflicts (audit only) */
  stateConflicts: StateConflict[];
  conflictsMarkdown?: string;
  /** L5 — weak inference for export sidebar only; does not modify snapshot */
  weakInferredBehavior: string[];
}

export function buildWeakInferredBehaviorLines(args: {
  taskAnchor: string;
  summary?: StateSummary;
  graph?: IntentGraph;
  confirmedAiGoals?: string[];
}): string[] {
  const raw: string[] = [];
  if (args.summary) {
    raw.push(...projectUnderstandingLines(args.summary));
    for (const a of args.summary.next_likely_actions.slice(0, 3)) {
      raw.push(a);
    }
  }
  if (args.graph) {
    raw.push(...activeIntentLines(args.graph, 4));
  }
  for (const g of args.confirmedAiGoals ?? []) {
    const t = g.trim();
    if (t) {
      raw.push(t);
    }
  }
  return filterWeakInferenceLines(raw, args.taskAnchor);
}

export async function loadCognitionExportContext(
  folder: vscode.WorkspaceFolder,
  state?: ProjectState,
  confirmedAiGoals?: string[],
): Promise<CognitionExportContext> {
  const [summary, graph, projectSnapshot, conflictsArtifact] = await Promise.all([
    readStateSummary(folder),
    readIntentGraph(folder),
    readProjectSnapshotMarkdown(folder),
    readConflictsArtifact(folder),
  ]);
  const stateConflicts = conflictsArtifact?.conflicts ?? [];
  const taskAnchor = state ? extractTaskAnchor(state) : '';
  return {
    summary,
    graph,
    projectSnapshot,
    stateConflicts,
    conflictsMarkdown: stateConflicts.length
      ? formatConflictsMarkdown(stateConflicts)
      : undefined,
    weakInferredBehavior: buildWeakInferredBehaviorLines({
      taskAnchor,
      summary,
      graph,
      confirmedAiGoals,
    }),
  };
}
