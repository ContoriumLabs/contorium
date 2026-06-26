import * as vscode from 'vscode';
import type { ExportMode } from '../ai/runExportAIContext';
import { withIdeCilAiContext } from '../ai/cilLlmBridge';

export type IdeTransferMode = 'context' | 'intelligence' | 'story' | 'essence' | 'handoff';

async function workspaceRoot(): Promise<string | undefined> {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/** Unified Transfer — IDE surface (matches CLI transfer --mode). */
export async function runIdeTransfer(
  mode: IdeTransferMode,
  exportRunner?: (mode: ExportMode) => Promise<{ text?: string } | void>,
): Promise<void> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace to transfer project context.');
    return;
  }

  try {
    if (mode === 'context' || mode === 'intelligence') {
      if (exportRunner) {
        await exportRunner(mode === 'intelligence' ? 'full-intelligence' : 'cognitive-snapshot');
      } else {
        await vscode.commands.executeCommand(
          mode === 'intelligence' ? 'contora.exportFullIntelligence' : 'contora.exportAIContext',
        );
      }
      return;
    }

    const { syncCognitiveInteractionLayer, runCognitiveKernel, getProjectHandoff } =
      await import('@contora/state-core');

    await withIdeCilAiContext(root, async () => {
      await syncCognitiveInteractionLayer(root, 'ide');

      let text = '';
      if (mode === 'handoff') {
        const handoff = await getProjectHandoff(root, 'markdown');
        text = handoff.text ?? '';
      } else if (mode === 'story') {
        const out = await runCognitiveKernel(root, { mode: 'story' });
        const story = out.result as { formatted_markdown?: string };
        text = story.formatted_markdown ?? JSON.stringify(out.result, null, 2);
      } else if (mode === 'essence') {
        const out = await runCognitiveKernel(root, { mode: 'essence' });
        const essence = out.result as { formatted_markdown?: string };
        text = essence.formatted_markdown ?? JSON.stringify(out.result, null, 2);
      }

      if (!text.trim()) {
        void vscode.window.showWarningMessage('Transfer: nothing to export — run Sync state first.');
        return;
      }

      try {
        await vscode.env.clipboard.writeText(text);
        void vscode.window.showInformationMessage(`Transfer (${mode}) copied to clipboard.`);
      } catch {
        const doc = await vscode.workspace.openTextDocument({ content: text, language: 'markdown' });
        await vscode.window.showTextDocument(doc, { preview: true });
      }
    });
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Transfer failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
