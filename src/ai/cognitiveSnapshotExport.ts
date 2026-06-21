import {
  buildFullIntelligenceMarkdown as buildFullIntelligenceMarkdownCore,
  buildTransferContextSnapshot,
  finalizeTransferContextText,
  formatTransferContextJson,
  formatTransferContextMarkdown,
  transferExportModeLabel,
  TRANSFER_CONTEXT_TOKEN_TARGET,
  FULL_INTELLIGENCE_TOKEN_TARGET,
  type TransferContextSnapshot,
  type TransferExportInput,
  type TransferExportMode,
} from '@contora/state-core';
import type { CognitionExportContext } from '../cognition/loaders';
import type { IntentGraph } from '../intent-graph/types';
import type { ProjectState } from '../types/state';

/** v2.3 Cognitive Snapshot — target 300–800 tokens. */
export const COGNITIVE_SNAPSHOT_TOKEN_TARGET = TRANSFER_CONTEXT_TOKEN_TARGET;
export { FULL_INTELLIGENCE_TOKEN_TARGET };

export type CognitiveSnapshot = TransferContextSnapshot;
export type ExportMode = TransferExportMode;

function toExportInput(
  root: string,
  state: ProjectState,
  cognition: CognitionExportContext,
  intentGraph?: IntentGraph | null,
): TransferExportInput {
  return {
    workspaceRoot: root,
    state: {
      sessionId: state.sessionId ?? '',
      currentTask: state.currentTask,
      openFiles: state.openFiles,
      recentFiles: state.recentFiles,
      gitStaged: state.gitStaged,
      gitWorking: state.gitWorking,
      notes: state.notes,
      lastUpdated: state.lastUpdated,
      source: state.source,
    },
    handoff: cognition.handoff,
    builtState: cognition.builtState,
    knowledgeSnapshot: cognition.knowledgeSnapshot,
    legacyIntentText:
      intentGraph?.nodes[0]?.text ?? cognition.summary?.project_intent,
  };
}

export async function buildCognitiveSnapshot(
  root: string,
  state: ProjectState,
  cognition: CognitionExportContext,
  intentGraph?: IntentGraph | null,
): Promise<CognitiveSnapshot> {
  return buildTransferContextSnapshot(toExportInput(root, state, cognition, intentGraph));
}

export function formatCognitiveSnapshotMarkdown(snapshot: CognitiveSnapshot): string {
  return formatTransferContextMarkdown(snapshot);
}

export function formatCognitiveSnapshotJson(snapshot: CognitiveSnapshot): string {
  return formatTransferContextJson(snapshot);
}

export function finalizeCognitiveSnapshotText(text: string, asJson: boolean): string {
  return finalizeTransferContextText(text, asJson);
}

export async function buildFullIntelligenceMarkdown(
  root: string,
  state: ProjectState,
  cognition: CognitionExportContext,
  intentGraph?: IntentGraph | null,
): Promise<string> {
  return buildFullIntelligenceMarkdownCore(toExportInput(root, state, cognition, intentGraph));
}

export function exportModeLabel(mode: ExportMode): string {
  return transferExportModeLabel(mode);
}
