import { confirmHandoffInjection, getProjectHandoff, skipHandoffInjection } from '@contora/state-core';
import { artifactSignature, loadDashboardState } from './artifacts.js';
import { tryClaimDashboardWorker, unregisterDashboardWorker } from './daemon.js';
import { releaseDashboardSpawnLock } from './spawnLock.js';
import { copyToClipboard } from '../handoff/clipboard.js';
import { setupKeyboard } from './input.js';
import { renderExpanded, renderIdleLine, renderPassiveLine } from './render.js';
import { consumeDashboardSignal } from './signals.js';
import { detectIdeSession } from './sessionDetect.js';
import { writeDashboardStatus } from './statusFile.js';
import { enterAlternateScreen, exitAlternateScreen, terminalHeight, } from './terminalUi.js';
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
    const ctx = () => ({
        useColor: options.useColor,
        width: terminalWidth(),
        height: terminalHeight(),
        live: Date.now() < liveUntil,
        filter,
        fsmState: fsm,
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
    const copyToAi = async () => {
        const result = await getProjectHandoff(options.workspaceRoot, 'markdown', filter);
        if (!result.found || !result.text) {
            showFlash('Copy To AI: not ready — save changes or run sync');
            return;
        }
        if (copyToClipboard(result.text)) {
            showFlash('Copy To AI — pasted in next chat (clipboard ready)');
            return;
        }
        showFlash('Clipboard unavailable — run: contorium handoff --copy');
    };
    const injectHandoff = async () => {
        const result = await confirmHandoffInjection(options.workspaceRoot, 'markdown');
        if (!result.ok || !result.text) {
            showFlash(result.hint ?? 'Inject: not ready');
            return;
        }
        lastData = await loadDashboardState(options.workspaceRoot);
        if (copyToClipboard(result.text)) {
            showFlash('Runtime injected — clipboard ready for new chat');
            return;
        }
        showFlash('Runtime injected → .contora/mcp.auto-context.md');
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
        maybeAutoInjectionFlash();
        render();
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
            const line = renderPassiveLine(lastData, updateCount, ctx());
            writeStatusLine(line);
            void persistStatus('passive', line);
            return;
        }
        const frame = renderExpanded(lastData, ctx());
        const frameWithFlash = flashMsg ? `${frame}\n\x1b[2m${flashMsg}\x1b[0m` : frame;
        void persistStatus('expanded', '[●] Contorium dashboard expanded', frameWithFlash);
        if (options.headless) {
            return;
        }
        clearScreen();
        process.stdout.write(frameWithFlash);
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
                return setupKeyboard((key) => {
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
                    // legacy aliases
                    if (key === 'v' && fsm === 'passive') {
                        fsm = transition('expanded');
                        return;
                    }
                    if (key === 'm' && fsm === 'expanded') {
                        fsm = transition('passive');
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
    const frame = renderExpanded(state, {
        useColor: options.useColor,
        width: terminalWidth(),
        fsmState: 'expanded',
    });
    process.stdout.write(`${frame}\n`);
}
