import { artifactSignature, loadDashboardState } from './artifacts.js';
import { renderDashboard } from './render.js';
function terminalWidth() {
    const cols = process.stdout.columns;
    return cols && cols >= 40 ? Math.min(cols, 100) : 80;
}
function clearScreen() {
    if (!process.stdout.isTTY) {
        return;
    }
    process.stdout.write('\x1b[2J\x1b[H');
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
export async function runDashboard(baseOptions) {
    const options = { ...baseOptions, width: terminalWidth() };
    let stopping = false;
    const onSigint = () => {
        stopping = true;
    };
    process.on('SIGINT', onSigint);
    hideCursor();
    let lastSig = '';
    try {
        do {
            const sig = await artifactSignature(options.workspaceRoot);
            if (sig !== lastSig || options.once) {
                const state = await loadDashboardState(options.workspaceRoot);
                options.width = terminalWidth();
                const frame = renderDashboard(state, options);
                if (process.stdout.isTTY && !options.once) {
                    clearScreen();
                }
                process.stdout.write(frame);
                lastSig = sig;
            }
            if (options.once) {
                break;
            }
            await sleep(options.intervalMs);
        } while (!stopping);
    }
    finally {
        showCursor();
        process.off('SIGINT', onSigint);
        if (!options.once && process.stdout.isTTY) {
            process.stdout.write('\n');
        }
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
