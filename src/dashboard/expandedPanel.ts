import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { writeDashboardSignal } from './ideSignals';

const PANEL_VIEW = 'contorium.expandedDashboard';
let panel: vscode.WebviewPanel | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;

async function readDashboardFrame(workspaceRoot: string): Promise<{
  mode?: string;
  frame?: string;
  line?: string;
  at?: number;
}> {
  try {
    const raw = await fs.readFile(
      path.join(workspaceRoot, '.contora', 'dashboard.status.json'),
      'utf8',
    );
    return JSON.parse(raw) as {
      mode?: string;
      frame?: string;
      line?: string;
      at?: number;
    };
  } catch {
    return {};
  }
}

function panelHtml(frame: string, passive?: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const body = frame
    ? esc(frame)
    : esc(passive ?? 'Waiting for dashboard worker…\nRun contorium bootstrap or save a file.');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px 16px;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family), ui-monospace, monospace;
    font-size: var(--vscode-editor-font-size, 13px);
    line-height: 1.45;
    overflow: auto;
    height: 100vh;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .badge {
    display: inline-block;
    margin-bottom: 8px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    font-size: 11px;
  }
</style>
</head>
<body>
  <div class="badge">Contorium Runtime · live</div>
  <pre>${body}</pre>
</body>
</html>`;
}

async function refreshPanel(workspaceRoot: string): Promise<void> {
  if (!panel) {
    return;
  }
  const status = await readDashboardFrame(workspaceRoot);
  const content = status.frame ?? status.line ?? '';
  panel.webview.html = panelHtml(content, status.line);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

/** IDE Expanded fullscreen — live webview fed by dashboard.status.json.frame */
export async function showExpandedDashboardPanel(
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  const ws = folder.uri.fsPath;
  await writeDashboardSignal(ws, 'expand');

  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      PANEL_VIEW,
      'Contorium Runtime',
      vscode.ViewColumn.Beside,
      { retainContextWhenHidden: true, enableScripts: false },
    );
    panel.onDidDispose(() => {
      panel = undefined;
      stopPolling();
      void writeDashboardSignal(ws, 'minimize');
    });
  } else {
    panel.reveal(vscode.ViewColumn.Beside);
  }

  await refreshPanel(ws);
  stopPolling();
  pollTimer = setInterval(() => {
    void refreshPanel(ws);
  }, 700);
}

export function disposeExpandedDashboardPanel(): void {
  stopPolling();
  panel?.dispose();
  panel = undefined;
}
