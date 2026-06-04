import type * as vscode from 'vscode';
import { readStateSummary } from '../intelligence';
import { activeIntentLines, projectUnderstandingLines, readIntentGraph } from '../intent-graph';
import { readProjectBuiltState, readProjectSnapshotMarkdown } from '../state-builder/store';
import type { ProjectBuiltState } from '../state-builder/types';
import {
  extractTaskAnchor,
  filterWeakInferenceLines,
  formatConflictsMarkdown,
  readConflictsArtifact,
} from '../state-engine';
import { readHandoffArtifact, readProjectKnowledgeGraph, readProjectTimeline } from '@contora/state-core';
import type { HandoffArtifact, KnowledgeSnapshot, ProjectTimeline } from '@contora/state-core';
import type { StateConflict } from '../state-engine/types';
import type { StateSummary } from '../intelligence/types';
import type { IntentGraph } from '../intent-graph/types';
import type { ProjectState } from '../types/state';

export interface CognitionExportContext {
  summary?: StateSummary;
  graph?: IntentGraph;
  /** L4 — normalized PROJECT SNAPSHOT markdown */
  projectSnapshot?: string;
  /** L4 — structured built state for canonical export */
  builtState?: ProjectBuiltState;
  /** v2 — unresolved state conflicts (audit only) */
  stateConflicts: StateConflict[];
  conflictsMarkdown?: string;
  /** L5 — weak inference for export sidebar only; does not modify snapshot */
  weakInferredBehavior: string[];
  /** V3.1 — AI handoff + evolution timeline for export */
  handoff?: HandoffArtifact;
  timeline?: ProjectTimeline;
  /** V3.1 — compact cognitive snapshot (preferred over full graph) */
  knowledgeSnapshot?: KnowledgeSnapshot;
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
  const [summary, graph, projectSnapshot, builtState, conflictsArtifact, handoff, timeline, knowledge] =
    await Promise.all([
      readStateSummary(folder),
      readIntentGraph(folder),
      readProjectSnapshotMarkdown(folder),
      readProjectBuiltState(folder),
      readConflictsArtifact(folder),
      readHandoffArtifact(folder.uri.fsPath),
      readProjectTimeline(folder.uri.fsPath),
      readProjectKnowledgeGraph(folder.uri.fsPath),
    ]);
  const stateConflicts = conflictsArtifact?.conflicts ?? [];
  const taskAnchor = state ? extractTaskAnchor(state) : '';
  return {
    summary,
    graph,
    projectSnapshot,
    builtState,
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
    handoff,
    timeline,
    knowledgeSnapshot: knowledge?.snapshot,
  };
}
