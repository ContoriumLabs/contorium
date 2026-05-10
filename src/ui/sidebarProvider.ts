import * as vscode from 'vscode';
import { StateManager } from '../state/stateManager';
import { ProjectState } from '../types/state';

type WebviewToExt =
  | { type: 'ready' }
  | { type: 'updateTask'; value: string }
  | { type: 'updateNotes'; value: string }
  | { type: 'openFile'; relativePath: string };

export class ContextRecallSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'contextRecall.sidebar';

  private view?: vscode.WebviewView;
  private folder: vscode.WorkspaceFolder | undefined;

  constructor(
    private readonly ctx: vscode.ExtensionContext,
    private readonly stateManager: StateManager,
  ) {}

  setWorkspaceFolder(folder: vscode.WorkspaceFolder | undefined): void {
    this.folder = folder;
    void this.pushStateToWebview();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.ctx.extensionUri],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg: WebviewToExt) => {
      if (msg.type === 'ready') {
        await this.pushStateToWebview();
        return;
      }
      const folder = this.folder ?? this.stateManager.getPrimaryFolder();
      if (!folder) {
        vscode.window.showWarningMessage('ContextRecall：请先打开含文件夹的工作区。');
        return;
      }
      if (msg.type === 'updateTask') {
        await this.stateManager.update(folder, { currentTask: msg.value });
        return;
      }
      if (msg.type === 'updateNotes') {
        await this.stateManager.update(folder, { notes: msg.value });
        return;
      }
      if (msg.type === 'openFile') {
        const uri = vscode.Uri.joinPath(folder.uri, msg.relativePath);
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc);
        } catch {
          await vscode.commands.executeCommand('vscode.open', uri);
        }
      }
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
  }

  async refresh(): Promise<void> {
    await this.pushStateToWebview();
  }

  private async pushStateToWebview(): Promise<void> {
    if (!this.view) {
      return;
    }
    const folder = this.folder ?? this.stateManager.getPrimaryFolder();
    if (!folder) {
      this.view.webview.postMessage({ type: 'state', state: null });
      return;
    }
    const state = await this.stateManager.load(folder);
    this.view.webview.postMessage({ type: 'state', state });
  }

  /**
   * Webview 必须允许 `webview.cspSource`，否则打包后 VS Code 注入的通信脚本会被 CSP 拦截，侧栏表现为空白/无响应。
   * @see https://code.visualstudio.com/api/extension-guides/webview#security
   */
  private getHtml(webview: vscode.Webview): string {
    const nonce = String(Math.random()).slice(2);
    const cspSource = webview.cspSource;
    const csp = [
      `default-src 'none'`,
      `style-src ${cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' ${cspSource}`,
    ].join('; ');
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ContextRecall</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 8px; }
    label { display: block; margin-top: 10px; font-weight: 600; }
    textarea, input { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 6px; }
    textarea { min-height: 72px; resize: vertical; }
    ul { padding-left: 18px; margin: 6px 0 0; }
    li { cursor: pointer; margin: 4px 0; color: var(--vscode-textLink-foreground); }
    li:hover { text-decoration: underline; }
    .muted { opacity: 0.75; font-size: 0.9em; margin-top: 8px; }
    .section { margin-top: 12px; }
  </style>
</head>
<body>
  <div class="muted">当前工作区状态（写入 <code>.context-recall/state.json</code>）。「工作集」记录的是你<strong>切换到过或保存过</strong>的文件，不是「磁盘上刚改过」才算。</div>
  <label for="task">当前任务</label>
  <textarea id="task" rows="3" placeholder="例如：重构支付重试逻辑…"></textarea>

  <div class="section">
    <label>工作集（最近切换 / 保存）</label>
    <ul id="recent"></ul>
  </div>

  <div class="section">
    <label>Git 变更（工作区）</label>
    <ul id="git"></ul>
  </div>

  <label for="notes">笔记</label>
  <textarea id="notes" rows="5" placeholder="给下次会话或 AI 的备忘…"></textarea>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const taskEl = document.getElementById('task');
    const notesEl = document.getElementById('notes');
    const recentEl = document.getElementById('recent');
    const gitEl = document.getElementById('git');

    let debounce;

    function debouncePost(type, value) {
      clearTimeout(debounce);
      debounce = setTimeout(() => vscode.postMessage({ type, value }), 400);
    }

    taskEl.addEventListener('input', () => debouncePost('updateTask', taskEl.value));
    notesEl.addEventListener('input', () => debouncePost('updateNotes', notesEl.value));

    function renderList(el, items, msgType) {
      el.innerHTML = '';
      if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.textContent = '（无）';
        li.style.cursor = 'default';
        li.style.color = 'var(--vscode-disabledForeground)';
        li.style.textDecoration = 'none';
        el.appendChild(li);
        return;
      }
      for (const p of items) {
        const li = document.createElement('li');
        li.textContent = p;
        li.addEventListener('click', () => vscode.postMessage({ type: msgType, relativePath: p }));
        el.appendChild(li);
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || msg.type !== 'state') return;
      const s = msg.state;
      if (!s) {
        taskEl.value = '';
        notesEl.value = '';
        renderList(recentEl, [], 'openFile');
        renderList(gitEl, [], 'openFile');
        return;
      }
      taskEl.value = s.currentTask || '';
      notesEl.value = s.notes || '';
      renderList(recentEl, s.recentFiles || [], 'openFile');
      renderList(gitEl, s.gitModified || [], 'openFile');
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}

export function formatAIExport(state: ProjectState): string {
  const lines: string[] = [];
  lines.push('Current Task:');
  lines.push(state.currentTask?.trim() ? state.currentTask.trim() : '（未填写）');
  lines.push('');
  lines.push('Open Files (tabs):');
  if (state.openFiles?.length) {
    for (const f of state.openFiles) {
      lines.push(`- ${f}`);
    }
  } else {
    lines.push('（无）');
  }
  lines.push('');
  lines.push('Recent Files (working set):');
  if (state.recentFiles?.length) {
    for (const f of state.recentFiles) {
      lines.push(`- ${f}`);
    }
  } else {
    lines.push('（无）');
  }
  lines.push('');
  lines.push('Git modified / unstaged:');
  if (state.gitModified?.length) {
    for (const f of state.gitModified) {
      lines.push(`- ${f}`);
    }
  } else {
    lines.push('（无或未在 Git 仓库中）');
  }
  lines.push('');
  lines.push('Important Notes:');
  lines.push(state.notes?.trim() ? state.notes.trim() : '（无）');
  return lines.join('\n');
}
