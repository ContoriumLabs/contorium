import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { showExpandedDashboardPanel } from './expandedPanel';
import { writeDashboardSignal } from './ideSignals';
import {
  confirmHandoffInjection,
  formatUnderstandingMiniGraph,
  readHandoffInjectionState,
  readUnderstandingGraph,
  skipHandoffInjection,
} from '@contora/state-core';

const TERMINAL_NAME = 'Contorium Dashboard';

function sessionPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.contora', 'dashboard.session.json');
}

export { writeDashboardSignal } from './ideSignals';

async function writeSessionMarker(workspaceRoot: string, active: boolean): Promise<void> {
  const payload = {
    active,
    startedAt: Date.now(),
    source: 'ide' as const,
    workspaceRoot,
  };
  const target = sessionPath(workspaceRoot);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
}

/** User expand: status bar click / hotkey — opens live fullscreen webview panel. */
export async function showRuntimeDashboard(folder: vscode.WorkspaceFolder): Promise<void> {
  await showExpandedDashboardPanel(folder);
  const ws = folder.uri.fsPath;
  const term = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME);
  if (term) {
    term.show();
  }
}

export async function hideRuntimeDashboard(folder: vscode.WorkspaceFolder): Promise<void> {
  await writeDashboardSignal(folder.uri.fsPath, 'minimize');
}

export async function endDashboardSession(folder: vscode.WorkspaceFolder): Promise<void> {
  await writeSessionMarker(folder.uri.fsPath, false);
}

/** Semi-auto handoff injection — IDE auto-prompt on new chat (no CLI command). */
export async function runInjectRuntimeHandoff(workspaceRoot: string): Promise<void> {
  const injection = await readHandoffInjectionState(workspaceRoot);
  if (injection?.status === 'injected') {
    const refreshed = await confirmHandoffInjection(workspaceRoot, 'markdown');
    if (refreshed.ok && refreshed.text) {
      await vscode.env.clipboard.writeText(refreshed.text);
      await vscode.window.showInformationMessage(
        'Contorium: runtime context refreshed — clipboard ready for new chat',
      );
    }
    return;
  }
  if (injection?.status === 'skipped') {
    await vscode.window.showInformationMessage('Contorium: injection skipped for this runtime session.');
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    'Contorium runtime active. Inject current working state to new AI chat?',
    'Inject',
    'Skip',
  );
  if (choice === 'Skip') {
    await skipHandoffInjection(workspaceRoot);
    return;
  }
  if (choice !== 'Inject') {
    return;
  }

  const result = await confirmHandoffInjection(workspaceRoot, 'markdown');
  if (!result.ok || !result.text) {
    await vscode.window.showWarningMessage(result.hint ?? 'Contorium: injection failed');
    return;
  }
  await vscode.env.clipboard.writeText(result.text);
  await vscode.window.showInformationMessage(
    'Contorium: runtime injected — clipboard ready for new chat',
  );
}

type DashViewMode = 'expanded' | 'passive' | 'idle';

/** Status bar colors — aligned with CLI dashboard (green run · yellow pending · gray idle). */
const STATUS_COLORS = {
  running: new vscode.ThemeColor('testing.iconPassed'),
  pending: new vscode.ThemeColor('editorWarning.foreground'),
  idle: new vscode.ThemeColor('descriptionForeground'),
} as const;

function applyStatusBarLook(
  item: vscode.StatusBarItem,
  tone: keyof typeof STATUS_COLORS,
): void {
  item.color = STATUS_COLORS[tone];
  item.backgroundColor = undefined;
}

async function hasActiveRuntime(workspaceRoot: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(
      path.join(workspaceRoot, '.contora', 'runtime.bootstrap.json'),
      'utf8',
    );
    const bootstrap = JSON.parse(raw) as { runtime_id?: string };
    return Boolean(bootstrap.runtime_id);
  } catch {
    return false;
  }
}

/** Dashboard view mode only — not a state source (handoff.json is). */
async function readDashboardViewMode(workspaceRoot: string): Promise<DashViewMode | undefined> {
  try {
    const raw = await fs.readFile(
      path.join(workspaceRoot, '.contora', 'dashboard.status.json'),
      'utf8',
    );
    const status = JSON.parse(raw) as { mode?: string };
    if (status.mode === 'expanded' || status.mode === 'passive' || status.mode === 'idle') {
      return status.mode;
    }
  } catch {
    // worker not running
  }
  return undefined;
}

/** Passive compact line — reads handoff.json + state.json (not dashboard.status.json). */
async function passiveLineFromHandoff(workspaceRoot: string): Promise<string | undefined> {
  try {
    const [handoffRaw, stateRaw] = await Promise.all([
      fs.readFile(path.join(workspaceRoot, '.contora', 'handoff.json'), 'utf8'),
      fs.readFile(path.join(workspaceRoot, '.contora', 'state.json'), 'utf8').catch(() => ''),
    ]);
    const handoff = JSON.parse(handoffRaw) as {
      current_focus?: string;
      goal?: string;
      key_changes?: { symbol: string; kind: string }[];
    };
    const state = stateRaw
      ? (JSON.parse(stateRaw) as { currentTask?: string; source?: { lastWriter?: string } })
      : {};
    const task = (state.currentTask || handoff.current_focus || handoff.goal || '').trim();
    if (!task && !handoff.key_changes?.length) {
      return undefined;
    }
    const kc = handoff.key_changes?.[0];
    const last = kc ? (kc.kind === 'function' ? `${kc.symbol}()` : kc.symbol) : '—';
    const agent = state.source?.lastWriter ?? 'runtime';
    const taskShort = task.length > 36 ? `${task.slice(0, 35)}…` : task || '(not set)';
    return `[Contorium] task: ${taskShort} | last: ${last} | agent: ${agent}`;
  } catch {
    return undefined;
  }
}

/** Passive line in status bar — reads handoff.json, not dashboard.status.json. */
export function registerDashboardStatusBar(
  context: vscode.ExtensionContext,
  getFolder: () => vscode.WorkspaceFolder | undefined,
): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  item.command = 'contora.showDashboard';
  item.tooltip =
    'Contorium — Space in terminal toggles Expanded · [?] inject when pending';

  let lastAutoPromptSession: string | undefined;

  const autoPromptInjection = (ws: string, injection: Awaited<ReturnType<typeof readHandoffInjectionState>>): void => {
    if (injection?.status !== 'pending') {
      return;
    }
    const sessionKey = injection.chat_session_id ?? String(injection.prompted_at);
    if (sessionKey === lastAutoPromptSession) {
      return;
    }
    lastAutoPromptSession = sessionKey;
    void runInjectRuntimeHandoff(ws);
  };

  const refresh = async (): Promise<void> => {
    const folder = getFolder();
    if (!folder) {
      item.hide();
      return;
    }
    const cfg = vscode.workspace.getConfiguration('contora');
    if (cfg.get<boolean>('autoAttachDashboard') === false) {
      item.hide();
      return;
    }

    const ws = folder.uri.fsPath;
    const viewMode = await readDashboardViewMode(ws);
    const injection = await readHandoffInjectionState(ws);
    autoPromptInjection(ws, injection);

    if (injection?.status === 'pending') {
      item.command = 'contora.injectRuntimeHandoff';
      item.text = '$(question) [?] Inject runtime?';
      item.tooltip = 'Contorium — pending inject (yellow) · click to confirm handoff for new AI chat';
      applyStatusBarLook(item, 'pending');
      item.show();
      return;
    }

    item.command = 'contora.showDashboard';
    const passive = await passiveLineFromHandoff(ws);
    const mini = formatUnderstandingMiniGraph(await readUnderstandingGraph(ws), 28);

    if (viewMode === 'expanded') {
      item.text = '$(dashboard) Contorium · Expanded';
      item.tooltip = 'Contorium — runtime active (green) · Space in terminal toggles Expanded';
      applyStatusBarLook(item, 'running');
      item.show();
      return;
    }

    if (passive) {
      const line = mini ? `${passive} · ${mini}` : passive;
      item.text = `$(circle-filled) ${line.slice(0, 56)}`;
      item.tooltip = 'Contorium — runtime active (green) · Space in terminal toggles Expanded';
      applyStatusBarLook(item, 'running');
      item.show();
      return;
    }

    const runtimeActive = await hasActiveRuntime(ws);
    if (viewMode === 'idle' || runtimeActive) {
      const idleLabel =
        viewMode === 'idle'
          ? '$(circle-outline) Contorium idle'
          : '$(circle-outline) Contorium starting…';
      item.text = idleLabel;
      item.tooltip =
        viewMode === 'idle'
          ? 'Contorium — idle (gray) · waiting for IDE session activity'
          : 'Contorium — idle (gray) · runtime bootstrapped, handoff pending sync';
      applyStatusBarLook(item, 'idle');
      item.show();
      return;
    }

    item.hide();
  };

  const timer = setInterval(() => void refresh(), 800);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
  context.subscriptions.push(item);
  void refresh();
}
