import type * as vscode from 'vscode';
import type { ProjectState } from '../types/state';
import { newSessionId } from '../state/stateManager';

type StateCore = typeof import('@contora/state-core');

let corePromise: Promise<StateCore> | undefined;

async function stateCore(): Promise<StateCore> {
  if (!corePromise) {
    corePromise = import('@contora/state-core').catch((err) => {
      corePromise = undefined;
      throw err;
    });
  }
  return corePromise;
}

function toBootstrap(state: ProjectState): import('@contora/state-core').BootstrapStateJson {
  return {
    sessionId: state.sessionId ?? newSessionId(),
    currentTask: state.currentTask,
    openFiles: state.openFiles,
    recentFiles: state.recentFiles,
    gitStaged: state.gitStaged,
    gitWorking: state.gitWorking,
    notes: state.notes,
    lastUpdated: state.lastUpdated,
    source: state.source,
  };
}

function fromBootstrap(b: import('@contora/state-core').BootstrapStateJson): ProjectState {
  return {
    sessionId: b.sessionId,
    currentTask: b.currentTask,
    openFiles: b.openFiles,
    recentFiles: b.recentFiles,
    gitStaged: b.gitStaged,
    gitWorking: b.gitWorking,
    notes: b.notes,
    lastUpdated: b.lastUpdated,
    source: b.source,
  };
}

const SCAN_TIMEOUT_MS = 8_000;

async function scanWithTimeout(
  core: StateCore,
  root: string,
): Promise<import('@contora/state-core').WorkspaceScanFacts> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      core.scanWorkspace(root),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('workspace scan timeout')), SCAN_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * v2.2 dual-mode for IDE — never blocks sidebar.
 * Skips heavy scan when IDE events already drive state (Mode A).
 */
export async function applyDualModeWorkspaceInput(
  folder: vscode.WorkspaceFolder,
  state: ProjectState,
  eventCount: number,
): Promise<ProjectState> {
  try {
    const core = await stateCore();
    const root = folder.uri.fsPath;
    const hadState = await core.stateJsonExists(root);

    // Mode A: IDE scanners + event log already maintain state — avoid full FS walk on every reload.
    if (hadState && eventCount > 0) {
      return state;
    }

    const scan = await scanWithTimeout(core, root);

    if (!hadState && eventCount === 0) {
      const boot = core.bootstrapStateFromScan(scan);
      await core.writeStateJson(root, boot, { mode: 'scan-driven', writer: 'ide' });
      await core.rebuildArtifactsFromScan(root, scan, boot, 'ide');
      return fromBootstrap(boot);
    }

    const dual = core.buildDualModeInput({
      state: toBootstrap(state),
      eventCount,
      scan,
    });
    const next = fromBootstrap(dual.state);
    if (
      next.lastUpdated !== state.lastUpdated ||
      JSON.stringify(next.gitStaged) !== JSON.stringify(state.gitStaged) ||
      JSON.stringify(next.gitWorking) !== JSON.stringify(state.gitWorking) ||
      (eventCount === 0 && next.recentFiles.length > state.recentFiles.length)
    ) {
      await core.writeStateJson(root, dual.state, { mode: dual.mode, writer: 'ide' });
    }
    return next;
  } catch (err) {
    console.warn('[Contorium] IDE dual-mode scan skipped:', err);
    return state;
  }
}
