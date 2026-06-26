import * as vscode from 'vscode';
import type { CilOverlay } from '../ui/sidebarCilPanel.js';

async function workspaceRoot(): Promise<string | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.uri.fsPath;
}

export async function fetchCilHistory(root: string): Promise<CilOverlay> {
  const { exploreHistory, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const result = await exploreHistory(root, 'last_7_days');
  return {
    kind: 'cil',
    title: 'Project History',
    subtitle: `${result.count} events · ${result.range.replace(/_/g, ' ')}`,
    lines: result.formatted.length ? result.formatted : ['(no events in range — run Sync state)'],
  };
}

export async function fetchCilDecisions(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'decisions' });
  const center = out.result as { formatted?: string[] };
  return {
    kind: 'cil',
    title: 'Decision Center',
    subtitle: 'ADR records · Why · Risk',
    lines: center.formatted?.length ? center.formatted : ['(no decisions recorded)'],
  };
}

export async function runCilHistoryPanel(): Promise<CilOverlay | undefined> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace to view project history.');
    return undefined;
  }
  try {
    return await fetchCilHistory(root);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Project History failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

export async function runCilDecisionsPanel(): Promise<CilOverlay | undefined> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace to view decisions.');
    return undefined;
  }
  try {
    return await fetchCilDecisions(root);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Decision Center failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

async function runCilOverlayPanel(
  title: string,
  loader: (root: string) => Promise<CilOverlay>,
  emptyMsg: string,
): Promise<CilOverlay | undefined> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage(emptyMsg);
    return undefined;
  }
  try {
    return await loader(root);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `${title} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

export async function fetchCilHealth(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'health' });
  const health = out.result as { formatted?: string[]; score?: number };
  return {
    kind: 'cil',
    title: 'Cognitive Health',
    subtitle: health.score != null ? `Score ${health.score}%` : undefined,
    lines: health.formatted?.length ? health.formatted : ['(run Sync state)'],
  };
}

export async function fetchCilDna(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'dna' });
  const dna = out.result as { formatted?: string[] };
  return {
    kind: 'cil',
    title: 'Project DNA',
    subtitle: 'Identity fingerprint',
    lines: dna.formatted?.length ? dna.formatted : ['(run Sync state)'],
  };
}

export async function fetchCilReplay(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'replay' });
  const replay = out.result as { formatted?: string[] };
  return {
    kind: 'cil',
    title: 'Handoff Replay',
    subtitle: 'Cognitive evolution',
    lines: replay.formatted?.length ? replay.formatted : ['(run Sync state)'],
  };
}

export async function fetchCilImpact(root: string, module: string): Promise<CilOverlay> {
  const { exploreImpact, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const impact = await exploreImpact(root, module);
  return {
    kind: 'cil',
    title: `Impact: ${module}`,
    subtitle: 'Blast radius',
    lines: impact.formatted,
  };
}

export const runCilHealthPanel = () =>
  runCilOverlayPanel('Cognitive Health', fetchCilHealth, 'Open a folder workspace first.');
export const runCilDnaPanel = () =>
  runCilOverlayPanel('Project DNA', fetchCilDna, 'Open a folder workspace first.');
export const runCilReplayPanel = () =>
  runCilOverlayPanel('Handoff Replay', fetchCilReplay, 'Open a folder workspace first.');
export async function runCilImpactPanel(): Promise<CilOverlay | undefined> {
  const mod = await vscode.window.showInputBox({
    title: 'Explore Impact',
    prompt: 'Module or file path',
    placeHolder: 'auth.ts',
  });
  if (!mod?.trim()) {
    return undefined;
  }
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace first.');
    return undefined;
  }
  try {
    return await fetchCilImpact(root, mod.trim());
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Impact failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}
