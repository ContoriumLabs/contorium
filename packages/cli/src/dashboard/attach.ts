import {
  confirmHandoffInjection,
  skipHandoffInjection,
} from '@contora/state-core';
import { artifactSignature, loadDashboardState } from './artifacts.js';
import { buildDashboardExportText, buildTransferContextText } from './exportContext.js';
import { tryClaimDashboardWorker, unregisterDashboardWorker } from './daemon.js';
import { releaseDashboardSpawnLock } from './spawnLock.js';
import { copyToClipboardAsync } from '../handoff/clipboard.js';
import { setupKeyboard } from './input.js';
import { renderExpanded, renderIdleLine } from './render.js';
import { readDashboardCognitiveInsights } from './cognitiveInsights.js';
import type { DashboardCognitiveInsights } from './cognitiveInsights.js';
import { consumeDashboardSignal } from './signals.js';
import { detectIdeSession } from './sessionDetect.js';
import { writeDashboardStatus } from './statusFile.js';
import {
  enterAlternateScreen,
  exitAlternateScreen,
  terminalHeight,
  writeFrameInPlace,
} from './terminalUi.js';
import {
  applyCognitiveModeFromDashboard,
  readDashboardCognitiveMode,
  type ContoriumMcpMode,
} from './cognitiveModeBridge.js';
import { watchContoraArtifacts } from './watchArtifacts.js';
import type { AttachOptions, DashboardFsmState, RenderContext } from './types.js';

function terminalWidth(): number {
  const cols = process.stdout.columns;
  return cols && cols >= 40 ? Math.min(cols, 100) : 80;
}

function clearScreen(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H');
  }
}

function writeStatusLine(text: string): void {
  if (!process.stdout.isTTY) {
    process.stdout.write(`${text}\n`);
    return;
  }
  process.stdout.write(`\r\x1b[K${text}`);
}

/** Pin compact panel to bottom rows; optional flash line directly above. */
function writeCompactLayout(lines: string[], flash?: string): void {
  if (!process.stdout.isTTY) {
    if (flash) {
      process.stdout.write(`${flash}\n`);
    }
    for (const line of lines) {
      process.stdout.write(`${line}\n`);
    }
    return;
  }

  const rows = terminalHeight();
  const panelRows = lines.length;
  const startRow = Math.max(1, rows - panelRows + 1);
  if (flash) {
    const flashRow = Math.max(1, startRow - 1);
    process.stdout.write(`\x1b[${flashRow};1H\x1b[K${flash}`);
  }
  for (let i = 0; i < panelRows; i++) {
    process.stdout.write(`\x1b[${startRow + i};1H\x1b[K${lines[i] ?? ''}`);
  }
}

function hideCursor(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?25l');
  }
}

function showCursor(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?25h');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveInitialFsm(options: AttachOptions): Promise<DashboardFsmState> {
  if (options.startExpanded || options.autoAttach) {
    const session = await detectIdeSession(options.workspaceRoot);
    if (session.active) {
      return 'expanded';
    }
  }
  return 'idle';
}

export async function runAttach(options: AttachOptions): Promise<void> {
  if (process.env.CONTORIUM_DASHBOARD_TITLE) {
    process.title = process.env.CONTORIUM_DASHBOARD_TITLE;
  }

  if (options.once) {
    await renderOnce(options);
    return;
  }

  if (!options.headless && !(await tryClaimDashboardWorker(options.workspaceRoot))) {
    process.stderr.write(
      '[contorium] Dashboard worker already running — close the other Contorium Dashboard window.\n',
    );
    if (process.stdout.isTTY) {
      await sleep(1500);
    }
    return;
  }

  if (options.headless) {
    const claimed = await tryClaimDashboardWorker(options.workspaceRoot);
    if (!claimed) {
      return;
    }
  }

  await releaseDashboardSpawnLock(options.workspaceRoot);
  let fsm: DashboardFsmState = await resolveInitialFsm(options);
  let stopping = false;
  let updateCount = 0;
  let lastSignalAt = 0;
  let expandedAt = 0;
  let filter: string | undefined;
  let lastData = await loadDashboardState(options.workspaceRoot);
  let lastSig = await artifactSignature(options.workspaceRoot);
  let lastInjectionPromptAt = 0;
  let teardownKeys: (() => void) | undefined;
  let flashMsg = '';
  let flashUntil = 0;
  let liveUntil = 0;
  let alternateActive = false;
  let tickCount = 0;
  let cognitiveModeSelection: 'A' | 'B' | 'C' = 'A';
  let cognitiveModeActive: ContoriumMcpMode = 'A';
  let cognitiveInsights: DashboardCognitiveInsights | undefined;
  let copyInFlight = false;
  let expandedLineCount = 0;
  let lastPersistKey = '';
  cognitiveModeActive = await readDashboardCognitiveMode(options.workspaceRoot);
  cognitiveModeSelection = cognitiveModeActive;
  cognitiveInsights = await readDashboardCognitiveInsights(options.workspaceRoot);

  const ctx = (): RenderContext => ({
    useColor: options.useColor,
    width: terminalWidth(),
    height: terminalHeight(),
    live: Date.now() < liveUntil,
    tickCount,
    filter,
    fsmState: fsm,
    cognitiveModeSelection,
    cognitiveModeActive,
    cognitiveInsights,
  });

  const enterExpandedScreen = (): void => {
    if (!options.headless && process.stdout.isTTY && !alternateActive) {
      enterAlternateScreen();
      alternateActive = true;
    }
  };

  const leaveExpandedScreen = (): void => {
    if (alternateActive) {
      exitAlternateScreen();
      alternateActive = false;
    }
  };

  const transition = (next: DashboardFsmState): DashboardFsmState => {
    if (fsm === next) {
      return fsm;
    }
    if (fsm === 'expanded' && next !== 'expanded') {
      leaveExpandedScreen();
      clearScreen();
      process.stdout.write('\n');
    }
    fsm = next;
    if (fsm === 'expanded') {
      expandedAt = Date.now();
      expandedLineCount = 0;
      enterExpandedScreen();
    }
    render();
    return fsm;
  };

  const persistStatus = async (mode: DashboardFsmState, line: string, frame?: string): Promise<void> => {
    await writeDashboardStatus(options.workspaceRoot, {
      mode,
      line,
      frame: frame ?? (mode === 'expanded' ? undefined : undefined),
      updateCount,
      at: Date.now(),
    });
  };

  const showFlash = (msg: string, ms = 2500): void => {
    flashMsg = msg;
    flashUntil = Date.now() + ms;
    render();
  };

  const maybeAutoInjectionFlash = (): void => {
    const inj = lastData.handoffInjection;
    if (inj?.status !== 'pending' || options.headless) {
      return;
    }
    const at = inj.prompted_at ?? 0;
    if (at <= lastInjectionPromptAt) {
      return;
    }
    lastInjectionPromptAt = at;
    showFlash('[?] Runtime active — Enter/i inject · n skip', 8000);
  };

  const buildCopyText = async (): Promise<string | undefined> =>
    buildTransferContextText(options.workspaceRoot);

  const buildRuntimeInjectText = async (): Promise<string | undefined> =>
    buildDashboardExportText(options.workspaceRoot, lastData, filter);

  const copyToAi = (): void => {
    if (copyInFlight) {
      return;
    }
    showFlash('Copying…', 6000);
    void buildCopyText().then((text) => {
      if (!text) {
        showFlash('Transfer Context: not ready — run sync or set focus');
        return;
      }
      copyInFlight = true;
      void copyToClipboardAsync(text).then((ok) => {
        copyInFlight = false;
        if (ok) {
          showFlash('Transfer Context copied — paste in new chat');
          return;
        }
        showFlash('Clipboard unavailable — run: contorium transfer context --copy');
      });
    });
  };

  const injectHandoff = async (): Promise<void> => {
    const text = await buildRuntimeInjectText();
    if (!text) {
      showFlash('Inject: not ready — save changes or run sync');
      return;
    }
    const result = await confirmHandoffInjection(options.workspaceRoot, 'markdown', { text });
    if (!result.ok) {
      showFlash(result.hint ?? 'Inject: not ready');
      return;
    }
    lastData = await loadDashboardState(options.workspaceRoot);
    void copyToClipboardAsync(text).then((ok) => {
      if (ok) {
        showFlash('Runtime injected — clipboard ready for new chat');
        return;
      }
      showFlash('Runtime injected → .contora/mcp.auto-context.md');
    });
  };

  const skipInjectHandoff = async (): Promise<void> => {
    await skipHandoffInjection(options.workspaceRoot);
    lastData = await loadDashboardState(options.workspaceRoot);
    showFlash('Injection skipped for this runtime session');
  };

  const injectionPending = (): boolean =>
    lastData.handoffInjection?.status === 'pending';

  const refreshCognitiveInsights = async (): Promise<void> => {
    cognitiveInsights = await readDashboardCognitiveInsights(options.workspaceRoot);
  };

  const refreshData = async (): Promise<void> => {
    const sig = await artifactSignature(options.workspaceRoot);
    if (sig === lastSig) {
      return;
    }
    lastData = await loadDashboardState(options.workspaceRoot);
    updateCount += 1;
    lastSig = sig;
    liveUntil = Date.now() + 2500;
    if (fsm === 'expanded') {
      expandedAt = Date.now();
    }
    await refreshCognitiveInsights();
    maybeAutoInjectionFlash();
    render();
  };

  const applyCognitiveModeSelection = async (): Promise<void> => {
    if (cognitiveModeSelection === 'C') {
      showFlash('Debug Trace — view-only (not persisted to MCP)', 2500);
      return;
    }
    if (cognitiveModeSelection === cognitiveModeActive) {
      showFlash(`Mode ${cognitiveModeActive === 'A' ? 'Live Cognition' : 'Governance Overlay'} already active`, 2000);
      return;
    }
    const result = await applyCognitiveModeFromDashboard(options.workspaceRoot, cognitiveModeSelection);
    cognitiveModeActive = cognitiveModeSelection;
    await refreshCognitiveInsights();
    showFlash(result.hint, 4000);
  };

  const persistStatusIfChanged = (mode: DashboardFsmState, line: string, frame?: string): void => {
    const key = `${mode}|${updateCount}|${line}|${frame?.length ?? 0}|${flashMsg}|${filter ?? ''}|${cognitiveModeActive}|${cognitiveModeSelection}`;
    if (key === lastPersistKey) {
      return;
    }
    lastPersistKey = key;
    void persistStatus(mode, line, frame);
  };

  const render = (): void => {
    if (flashUntil > 0 && Date.now() > flashUntil) {
      flashMsg = '';
      flashUntil = 0;
    }
    if (fsm === 'idle') {
      const line = renderIdleLine(ctx());
      writeStatusLine(line);
      void persistStatus('idle', line);
      return;
    }
    const frame = renderExpanded(lastData, ctx());
    const frameWithFlash = flashMsg ? `${frame}\n\x1b[2m${flashMsg}\x1b[0m` : frame;
    persistStatusIfChanged('expanded', '[●] Contorium dashboard', frameWithFlash);
    if (options.headless) {
      return;
    }
    expandedLineCount = writeFrameInPlace(frameWithFlash, expandedLineCount);
  };

  const onSigint = (): void => {
    stopping = true;
  };
  process.on('SIGINT', onSigint);

  if (!options.headless && process.stdout.isTTY) {
    hideCursor();
  }
  if (fsm === 'expanded') {
    expandedAt = Date.now();
    enterExpandedScreen();
  }
  render();
  maybeAutoInjectionFlash();
  teardownKeys = options.headless
    ? undefined
    : (() => {
        try {
          return setupKeyboard((key, raw) => {
    const modeSelectUp = raw === '\u001b[A' || key === 'k';
    const modeSelectDown = raw === '\u001b[B' || key === 'j';
    const cycleViewMode = (dir: 1 | -1): void => {
      const order: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
      const idx = order.indexOf(cognitiveModeSelection);
      const next = order[(idx + dir + order.length) % order.length]!;
      cognitiveModeSelection = next;
      render();
    };
    if (fsm === 'expanded' && modeSelectUp) {
      cycleViewMode(-1);
      return;
    }
    if (fsm === 'expanded' && modeSelectDown) {
      cycleViewMode(1);
      return;
    }
    if (key === 'q' || key === '\u0003') {
      stopping = true;
      return;
    }
    if (key === 'c') {
      void copyToAi();
      return;
    }
    if (injectionPending() && (key === 'i' || key === 'y' || key === '\r' || key === '\n')) {
      void injectHandoff();
      return;
    }
    if (injectionPending() && key === 'n') {
      void skipInjectHandoff();
      return;
    }
    if (
      fsm === 'expanded' &&
      (key === '\r' || key === '\n' || key === 'o')
    ) {
      void applyCognitiveModeSelection();
      return;
    }
          });
        } catch (err) {
          process.stderr.write(
            `[contorium] keyboard setup skipped: ${err instanceof Error ? err.message : err}\n`,
          );
          return undefined;
        }
      })();

  const unwatch = watchContoraArtifacts(options.workspaceRoot, () => {
    void refreshData();
  });

  try {
    while (!stopping) {
      const session = await detectIdeSession(options.workspaceRoot);
      if (!session.active && fsm !== 'idle') {
        fsm = 'idle';
        updateCount = 0;
        render();
      } else if (session.active && fsm === 'idle') {
        fsm = transition('expanded');
      }

      const signal = await consumeDashboardSignal(options.workspaceRoot, lastSignalAt);
      if (signal) {
        lastSignalAt = signal.at;
        if (signal.action === 'filter') {
          filter = signal.filter?.trim() || undefined;
          render();
        } else if (signal.action === 'clear-filter') {
          filter = undefined;
          render();
        }
      }

      tickCount += 1;
      if (fsm === 'expanded') {
        render();
      }

      await sleep(options.intervalMs);
    }
  } finally {
    unwatch();
    teardownKeys?.();
    leaveExpandedScreen();
    if (!options.headless && process.stdout.isTTY) {
      showCursor();
    }
    process.off('SIGINT', onSigint);
    await unregisterDashboardWorker(options.workspaceRoot);
    if (process.stdout.isTTY) {
      process.stdout.write('\n');
    }
  }
}

async function renderOnce(options: AttachOptions): Promise<void> {
  const state = await loadDashboardState(options.workspaceRoot);
  const active = await readDashboardCognitiveMode(options.workspaceRoot);
  const insights = await readDashboardCognitiveInsights(options.workspaceRoot);
  const frame = renderExpanded(state, {
    useColor: options.useColor,
    width: terminalWidth(),
    fsmState: 'expanded',
    cognitiveModeSelection: active,
    cognitiveModeActive: active,
    cognitiveInsights: insights,
  });
  process.stdout.write(`${frame}\n`);
}
