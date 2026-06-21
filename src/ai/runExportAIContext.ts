import * as vscode from 'vscode';
import { MemoryBuilder, ModeEngine, estimateTokens, type EventStore } from '../core';
import { loadUsableIntentFocusLines } from '../core/memory/intentStore';
import { loadCognitionExportContext } from '../cognition/loaders';
import { readIntentGraph } from '../intent-graph';
import { StateManager } from '../state/stateManager';
import { CONTORA_CONFIG_SECTION, PRODUCT_DISPLAY_NAME } from '../constants';
import { runAndPersistGovernanceReview } from './governanceReviewBridge';
import {
  deliverExportText,
  formatExportDeliveryMessage,
  readExportDelivery,
} from './injectIntoAiChat';
import { readExportFormat } from './exportFormat';
import type { ProviderManager } from './providers/providerManager';
import type { WorkspaceScanner } from '../scanner/workspaceScanner';
import type { CognitionPipeline } from '../cognition/cognitionPipeline';
import {
  buildCognitiveSnapshot,
  buildFullIntelligenceMarkdown,
  exportModeLabel,
  finalizeCognitiveSnapshotText,
  formatCognitiveSnapshotJson,
  formatCognitiveSnapshotMarkdown,
  type ExportMode,
} from './cognitiveSnapshotExport';

export type { ExportMode } from './cognitiveSnapshotExport';

export type ExportProgressPhase =
  | 'sync'
  | 'load'
  | 'cognition'
  | 'governance'
  | 'build'
  | 'compress'
  | 'deliver'
  | 'done'
  | 'error';

export interface ExportProgressUpdate {
  phase: ExportProgressPhase;
  label: string;
  percent: number;
}

export type ExportProgressReporter = (update: ExportProgressUpdate) => void;

export interface RunExportAIContextResult {
  ok: boolean;
  message: string;
}

export interface RunExportAIContextDeps {
  stateManager: StateManager;
  ensureWorkspaceReady: () => Promise<boolean>;
  ensureIgnoreMatcher: (folder: vscode.WorkspaceFolder) => Promise<unknown>;
  getEventStore: () => EventStore | undefined;
  getScanners: () => WorkspaceScanner[];
  getCognitionPipeline: () => CognitionPipeline | undefined;
  shouldIgnore: () => (p: string) => boolean;
  memoryBuilder: MemoryBuilder;
  modeEngine: ModeEngine;
  aiProviders: ProviderManager;
  eventsInPrompt: () => number;
  readExportFormat: () => ReturnType<typeof readExportFormat>;
  onAfterGovernanceReview?: () => void;
}

function noopReporter(_update: ExportProgressUpdate): void {
  /* optional */
}

function reportProgress(
  reporter: ExportProgressReporter | undefined,
  phase: ExportProgressPhase,
  label: string,
  percent: number,
): void {
  reporter?.({ phase, label, percent });
}

async function prepareExportWorkspace(deps: RunExportAIContextDeps, reporter: ExportProgressReporter | undefined) {
  const folder = deps.stateManager.getPrimaryFolder();
  if (!folder) {
    const message = `${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`;
    reportProgress(reporter, 'error', message, 0);
    return { ok: false as const, message };
  }

  reportProgress(reporter, 'sync', 'Syncing workspace…', 4);
  if (!(await deps.ensureWorkspaceReady())) {
    const message = `${PRODUCT_DISPLAY_NAME}: Workspace not ready.`;
    reportProgress(reporter, 'error', message, 0);
    return { ok: false as const, message };
  }

  await deps.ensureIgnoreMatcher(folder);
  const es = deps.getEventStore();
  if (!es) {
    const message = `${PRODUCT_DISPLAY_NAME}: Event store unavailable.`;
    reportProgress(reporter, 'error', message, 0);
    return { ok: false as const, message };
  }

  for (const s of deps.getScanners()) {
    await s.flushNow();
  }
  await deps.getCognitionPipeline()?.flushNow(es);

  reportProgress(reporter, 'load', 'Loading project state…', 16);
  const state = await deps.stateManager.load(folder);

  reportProgress(reporter, 'cognition', 'Reading intelligence layer…', 30);
  const confirmedAiIntentGoals = await loadUsableIntentFocusLines(folder, state, es);
  const cognition = await loadCognitionExportContext(folder, state, confirmedAiIntentGoals);
  const intentGraph = await readIntentGraph(folder);

  return { ok: true as const, folder, state, cognition, intentGraph };
}

export async function runExportAIContext(
  deps: RunExportAIContextDeps,
  reporter: ExportProgressReporter = noopReporter,
  mode: ExportMode = 'cognitive-snapshot',
): Promise<RunExportAIContextResult> {
  try {
    const prepared = await prepareExportWorkspace(deps, reporter);
    if (!prepared.ok) {
      return prepared;
    }

    const { folder, state, cognition, intentGraph } = prepared;
    const taskTrim = (state.currentTask ?? '').trim();
    const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
    const fmt = deps.readExportFormat();
    const asJson = fmt === 'json';

    let text: string;
    let fmtLabel = exportModeLabel(mode);

    if (mode === 'cognitive-snapshot') {
      reportProgress(reporter, 'build', 'Building cognitive snapshot…', 58);
      const snapshot = await buildCognitiveSnapshot(folder.uri.fsPath, state, cognition, intentGraph);
      text = asJson ?
        formatCognitiveSnapshotJson(snapshot)
      : formatCognitiveSnapshotMarkdown(snapshot);
      reportProgress(reporter, 'compress', 'Compressing snapshot…', 72);
      text = finalizeCognitiveSnapshotText(text, asJson);
      fmtLabel = asJson ? 'Transfer Context JSON' : 'Transfer Context';
    } else {
      reportProgress(reporter, 'governance', 'Running governance review…', 44);
      await runAndPersistGovernanceReview(folder);
      deps.onAfterGovernanceReview?.();

      reportProgress(reporter, 'build', 'Building full intelligence…', 58);
      text = await buildFullIntelligenceMarkdown(folder.uri.fsPath, state, cognition, intentGraph);
      fmtLabel = 'Transfer Intelligence';
    }

    reportProgress(reporter, 'deliver', 'Inserting into chat…', 88);
    const delivery = readExportDelivery(cfg);
    const deliverResult = await deliverExportText(text, delivery);

    const tok = estimateTokens(text);
    let message = `${PRODUCT_DISPLAY_NAME}: ${formatExportDeliveryMessage(deliverResult, tok, fmtLabel, '')}`;
    if (mode === 'cognitive-snapshot' && !taskTrim) {
      message += ' — set Current focus for better continuity.';
    }

    const doneLabel =
      deliverResult.injected ?
        mode === 'cognitive-snapshot' ?
          'Context transferred'
        : 'Intelligence transferred'
      : 'Copied to clipboard';
    reportProgress(reporter, 'done', doneLabel, 100);
    return { ok: true, message };
  } catch (err) {
    const message =
      err instanceof Error ? `${PRODUCT_DISPLAY_NAME}: Export failed — ${err.message}` : `${PRODUCT_DISPLAY_NAME}: Export failed.`;
    reportProgress(reporter, 'error', message, 0);
    return { ok: false, message };
  }
}
