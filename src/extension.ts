import * as vscode from 'vscode';
import { WorkspaceScanner } from './scanner/workspaceScanner';
import { StateManager } from './state/stateManager';
import { autoRestoreIfEnabled, restoreEditorsFromState } from './state/recovery';
import { formatAIExport, ContextRecallSidebarProvider } from './ui/sidebarProvider';

let scanners: WorkspaceScanner[] = [];

function disposeScanners(): void {
  for (const s of scanners) {
    s.dispose();
  }
  scanners = [];
}

function startScanners(stateManager: StateManager): WorkspaceScanner[] {
  disposeScanners();
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return [];
  }
  const next: WorkspaceScanner[] = [];
  for (const folder of folders) {
    const s = new WorkspaceScanner(folder, stateManager);
    s.start();
    next.push(s);
  }
  scanners = next;
  return next;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const stateManager = new StateManager();
  const sidebar = new ContextRecallSidebarProvider(context, stateManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ContextRecallSidebarProvider.viewId, sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  const syncWorkspace = () => {
    startScanners(stateManager);
    const primary = stateManager.getPrimaryFolder();
    sidebar.setWorkspaceFolder(primary);
  };

  syncWorkspace();
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => syncWorkspace()));

  const primary = stateManager.getPrimaryFolder();
  if (primary) {
    await stateManager.load(primary);
    await autoRestoreIfEnabled(stateManager, primary);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('contextRecall.exportAIContext', async () => {
      const folder = stateManager.getPrimaryFolder();
      if (!folder) {
        await vscode.window.showWarningMessage('ContextRecall：请先打开含文件夹的工作区。');
        return;
      }
      for (const s of scanners) {
        await s.flushNow();
      }
      const state = await stateManager.load(folder);
      const text = formatAIExport(state);
      await vscode.env.clipboard.writeText(text);
      await vscode.window.showInformationMessage('ContextRecall：已复制「AI 上下文」到剪贴板。');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contextRecall.saveStateNow', async () => {
      const folder = stateManager.getPrimaryFolder();
      if (!folder) {
        await vscode.window.showWarningMessage('ContextRecall：请先打开含文件夹的工作区。');
        return;
      }
      for (const s of scanners) {
        await s.flushNow();
      }
      await stateManager.load(folder);
      await sidebar.refresh();
      await vscode.window.showInformationMessage('ContextRecall：状态已写入 .context-recall/state.json。');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contextRecall.restoreSession', async () => {
      const folder = stateManager.getPrimaryFolder();
      if (!folder) {
        await vscode.window.showWarningMessage('ContextRecall：请先打开含文件夹的工作区。');
        return;
      }
      const state = await stateManager.load(folder);
      await restoreEditorsFromState(folder, state);
      await vscode.window.showInformationMessage('ContextRecall：已根据上次记录尝试打开文件。');
    }),
  );

  context.subscriptions.push({ dispose: () => disposeScanners() });
}

export function deactivate(): void {
  disposeScanners();
}
