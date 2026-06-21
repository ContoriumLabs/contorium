import * as vscode from 'vscode';
import { compileGovernanceInjectPrompt, readUserRequestOverlay, type GovernanceInjectMode } from '@contora/state-core';
import { CONTORA_CONFIG_SECTION, PRODUCT_DISPLAY_NAME } from '../constants';
import type { StateManager } from '../state/stateManager';
import { runAndPersistGovernanceReview, activeRelativeFile } from './governanceReviewBridge';
import { deliverExportText, formatExportDeliveryMessage, readExportDelivery } from './injectIntoAiChat';

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function runGovernanceInject(
  stateManager: StateManager,
  mode: GovernanceInjectMode,
): Promise<void> {
  const folder = stateManager.getPrimaryFolder();
  if (!folder) {
    await vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
    return;
  }

  const root = folder.uri.fsPath;
  await runAndPersistGovernanceReview(folder);

  const [state, overlay] = await Promise.all([
    stateManager.load(folder),
    readUserRequestOverlay(root),
  ]);

  const text = await compileGovernanceInjectPrompt(
    {
      workspaceRoot: root,
      projectGoal: overlay?.goal?.trim() || undefined,
      userTask: state.currentTask ?? '',
      activeFile: activeRelativeFile(),
    },
    mode,
  );

  const delivery = readExportDelivery();
  const deliverResult = await deliverExportText(text, delivery);
  const tok = estimateTokens(text);
  const label = mode === 'smart' ? 'Context synthesis' : 'Diff-scoped synthesis';
  const msg = `${PRODUCT_DISPLAY_NAME}: ${label} — ${formatExportDeliveryMessage(deliverResult, tok, mode, '')}`;
  await vscode.window.showInformationMessage(msg);
}

/** @deprecated Use runGovernanceInject */
export async function runGovernanceInjectToClipboard(
  stateManager: StateManager,
  mode: GovernanceInjectMode,
): Promise<void> {
  return runGovernanceInject(stateManager, mode);
}

export function readGovernanceInjectDelivery(
  cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION),
): ReturnType<typeof readExportDelivery> {
  return readExportDelivery(cfg);
}
