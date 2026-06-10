import { buildChpHandoffStateSync, confirmHandoffInjection, formatChpMarkdown, skipHandoffInjection, } from '@contora/state-core';
import { artifactSignature, loadDashboardState } from './artifacts.js';
import { tryClaimDashboardWorker, unregisterDashboardWorker } from './daemon.js';
import { releaseDashboardSpawnLock } from './spawnLock.js';
import { copyToClipboardAsync } from '../handoff/clipboard.js';
import { setupKeyboard } from './input.js';
import { renderExpanded, renderIdleLine } from './render.js';
import { renderCompactView } from './renderCompact.js';
import { readDashboardCognitiveInsights } from './cognitiveInsights.js';
import { consumeDashboardSignal } from './signals.js';
import { detectIdeSession } from './sessionDetect.js';
import { writeDashboardStatus } from './statusFile.js';
import { enterAlternateScreen, exitAlternateScreen, terminalHeight, writeFrameInPlace, } from './terminalUi.js';
import { applyCognitiveModeFromDashboard, readDashboardCognitiveMode, } from './cognitiveModeBridge.js';
import { watchContoraArtifacts } from './watchArtifacts.js';
function terminalWidth() {
    const cols = process.stdout.columns;
    return cols && cols >= 40 ? Math.min(cols, 100) : 80;
}
function clearScreen() {
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[2J\x1b[H');
    }
}
function writeStatusLine(text) {
    if (!process.stdout.isTTY) {
        process.stdout.write(`${text}\n`);
        return;
    }
    process.stdout.write(`\r\x1b[K${text}`);
}
/** Pin compact panel to bottom rows; optional flash line directly above. */
function writeCompactLayout(lines, flash) {
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
function hideCursor() {
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[?25l');
    }
}
function showCursor() {
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[?25h');
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function resolveInitialFsm(options) {
    if (options.startExpanded) {
        return 'expanded';
    }
    if (options.autoAttach) {
        const session = await detectIdeSession(options.workspaceRoot);
        if (session.active) {
            return 'passive';
        }
    }
    return 'idle';
}
export async function runAttach(options) {
    if (process.env.CONTORIUM_DASHBOARD_TITLE) {
        process.title = process.env.CONTORIUM_DASHBOARD_TITLE;
    }
    if (options.once) {
        await renderOnce(options);
        return;
    }
    if (!options.headless && !(await tryClaimDashboardWorker(options.workspaceRoot))) {
        process.stderr.write('[contorium] Dashboard worker already running — close the other Contorium Dashboard window.\n');
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
    let fsm = await resolveInitialFsm(options);
    let stopping = false;
    let updateCount = 0;
    let lastSignalAt = 0;
    let expandedAt = 0;
    let filter;
    let lastData = await loadDashboardState(options.workspaceRoot);
    let lastSig = await artifactSignature(options.workspaceRoot);
    let lastInjectionPromptAt = 0;
    let teardownKeys;
    let flashMsg = '';
    let flashUntil = 0;
    let liveUntil = 0;
    let alternateActive = false;
    let tickCount = 0;
    let cognitiveModeSelection = 'A';
    let cognitiveModeActive = 'A';
    let cognitiveInsights;
    let copyInFlight = false;
    let expandedLineCount = 0;
    let lastPersistKey = '';
    cognitiveModeActive = await readDashboardCognitiveMode(options.workspaceRoot);
    cognitiveModeSelection = cognitiveModeActive;
    cognitiveInsights = await readDashboardCognitiveInsights(options.workspaceRoot);
    const ctx = () => ({
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
    const enterExpandedScreen = () => {
        if (!options.headless && process.stdout.isTTY && !alternateActive) {
            enterAlternateScreen();
            alternateActive = true;
        }
    };
    const leaveExpandedScreen = () => {
        if (alternateActive) {
            exitAlternateScreen();
            alternateActive = false;
        }
    };
    const transition = (next) => {
        if (fsm === next) {
            return fsm;
        }
        if (fsm === 'expanded' && next !== 'expanded') {
            leaveExpandedScreen();
            clearScreen();
            process.stdout.write('\n');
        }
        if (next === 'expanded') {
            enterExpandedScreen();
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
    const persistStatus = async (mode, line, frame) => {
        await writeDashboardStatus(options.workspaceRoot, {
            mode,
            line,
            frame: frame ?? (mode === 'expanded' ? undefined : undefined),
            updateCount,
            at: Date.now(),
        });
    };
    const showFlash = (msg, ms = 2500) => {
        flashMsg = msg;
        flashUntil = Date.now() + ms;
        render();
    };
    const maybeAutoInjectionFlash = () => {
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
    const buildCopyText = () => {
        const chp = buildChpHandoffStateSync({
            workspaceRoot: options.workspaceRoot,
            handoff: lastData.handoff,
            change: lastData.change,
            currentTask: lastData.status.currentTask,
            lastWriter: lastData.status.lastWriter,
        });
        if (!chp) {
            return undefined;
        }
        const trimmed = filter?.trim();
        const state = trimmed
            ? {
                ...chp,
                recent_changes: chp.recent_changes.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase())),
            }
            : chp;
        return formatChpMarkdown(state, lastData.handoff, lastData.timeline);
    };
    const copyToAi = () => {
        if (copyInFlight) {
            return;
        }
        showFlash('Copying…', 6000);
        const text = buildCopyText();
        if (!text) {
            showFlash('Copy To AI: not ready — save changes or run sync');
            return;
        }
        copyInFlight = true;
        void copyToClipboardAsync(text).then((ok) => {
            copyInFlight = false;
            if (ok) {
                showFlash('Copy To AI — clipboard ready');
                return;
            }
            showFlash('Clipboard unavailable — run: contorium handoff --copy');
        });
    };
    const injectHandoff = async () => {
        const result = await confirmHandoffInjection(options.workspaceRoot, 'markdown');
        if (!result.ok || !result.text) {
            showFlash(result.hint ?? 'Inject: not ready');
            return;
        }
        lastData = await loadDashboardState(options.workspaceRoot);
        void copyToClipboardAsync(result.text).then((ok) => {
            if (ok) {
                showFlash('Runtime injected — clipboard ready for new chat');
                return;
            }
            showFlash('Runtime injected → .contora/mcp.auto-context.md');
        });
    };
    const skipInjectHandoff = async () => {
        await skipHandoffInjection(options.workspaceRoot);
        lastData = await loadDashboardState(options.workspaceRoot);
        showFlash('Injection skipped for this runtime session');
    };
    const injectionPending = () => lastData.handoffInjection?.status === 'pending';
    const toggleView = () => {
        if (fsm === 'passive') {
            fsm = transition('expanded');
        }
        else if (fsm === 'expanded') {
            fsm = transition('passive');
        }
    };
    const refreshCognitiveInsights = async () => {
        cognitiveInsights = await readDashboardCognitiveInsights(options.workspaceRoot);
    };
    const refreshData = async () => {
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
    const applyCognitiveModeSelection = async () => {
        if (cognitiveModeSelection === cognitiveModeActive) {
            showFlash(`Mode ${cognitiveModeActive} already active`, 2000);
            return;
        }
        const result = await applyCognitiveModeFromDashboard(options.workspaceRoot, cognitiveModeSelection);
        cognitiveModeActive = cognitiveModeSelection;
        await refreshCognitiveInsights();
        showFlash(result.hint, 4000);
    };
    const persistStatusIfChanged = (mode, line, frame) => {
        const key = `${mode}|${updateCount}|${line}|${frame?.length ?? 0}|${flashMsg}|${filter ?? ''}|${cognitiveModeActive}|${cognitiveModeSelection}`;
        if (key === lastPersistKey) {
            return;
        }
        lastPersistKey = key;
        void persistStatus(mode, line, frame);
    };
    const render = () => {
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
        if (fsm === 'passive') {
            const lines = renderCompactView(lastData, ctx());
            const flashLine = flashMsg ? `\x1b[2m${flashMsg}\x1b[0m` : undefined;
            writeCompactLayout(lines, flashLine);
            writeCompactLayout(lines, flashLine);
            persistStatusIfChanged('passive', flashMsg ?? lines[1] ?? '[Contorium] compact');
            return;
        }
        const frame = renderExpanded(lastData, ctx());
        const frameWithFlash = flashMsg ? `${frame}\n\x1b[2m${flashMsg}\x1b[0m` : frame;
        persistStatusIfChanged('expanded', '[●] Contorium dashboard expanded', frameWithFlash);
        if (options.headless) {
            return;
        }
        expandedLineCount = writeFrameInPlace(frameWithFlash, expandedLineCount);
    };
    const onSigint = () => {
        stopping = true;
    };
    process.on('SIGINT', onSigint);
    if (!options.headless && process.stdout.isTTY) {
        hideCursor();
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
                    if ((fsm === 'passive' || fsm === 'expanded') && modeSelectUp) {
                        cognitiveModeSelection = 'A';
                        render();
                        return;
                    }
                    if ((fsm === 'passive' || fsm === 'expanded') && modeSelectDown) {
                        cognitiveModeSelection = 'B';
                        render();
                        return;
                    }
                    if (key === 'q' || key === '\u0003') {
                        stopping = true;
                        return;
                    }
                    if (key === ' ') {
                        toggleView();
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
                    if ((fsm === 'passive' || fsm === 'expanded') &&
                        (key === '\r' || key === '\n' || key === 'o')) {
                        void applyCognitiveModeSelection();
                        return;
                    }
                    // legacy aliases
                    if (key === 'v' && fsm === 'passive') {
                        fsm = transition('expanded');
                        return;
                    }
                });
            }
            catch (err) {
                process.stderr.write(`[contorium] keyboard setup skipped: ${err instanceof Error ? err.message : err}\n`);
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
            }
            else if (session.active && fsm === 'idle') {
                fsm = transition('passive');
            }
            const signal = await consumeDashboardSignal(options.workspaceRoot, lastSignalAt);
            if (signal) {
                lastSignalAt = signal.at;
                if (signal.action === 'expand' && fsm === 'passive') {
                    fsm = transition('expanded');
                }
                else if (signal.action === 'minimize' && fsm === 'expanded') {
                    fsm = transition('passive');
                }
                else if (signal.action === 'filter') {
                    filter = signal.filter?.trim() || undefined;
                    render();
                }
                else if (signal.action === 'clear-filter') {
                    filter = undefined;
                    render();
                }
            }
            if (fsm === 'expanded' &&
                options.timeoutMs > 0 &&
                expandedAt > 0 &&
                Date.now() - expandedAt >= options.timeoutMs) {
                fsm = transition('passive');
            }
            tickCount += 1;
            if (fsm === 'passive' || fsm === 'expanded') {
                render();
            }
            await sleep(options.intervalMs);
        }
    }
    finally {
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
async function renderOnce(options) {
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
