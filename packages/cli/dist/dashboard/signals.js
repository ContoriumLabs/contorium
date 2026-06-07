import * as fs from 'node:fs/promises';
import * as path from 'node:path';
function signalPath(workspaceRoot) {
    return path.join(workspaceRoot, '.contora', 'dashboard.signal.json');
}
export async function writeDashboardSignal(workspaceRoot, action, filter) {
    const payload = { action, filter, at: Date.now() };
    const target = signalPath(workspaceRoot);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
}
/** Read and clear signal if newer than `since`. */
export async function consumeDashboardSignal(workspaceRoot, since) {
    const target = signalPath(workspaceRoot);
    let raw;
    try {
        raw = await fs.readFile(target, 'utf8');
    }
    catch {
        return undefined;
    }
    let signal;
    try {
        signal = JSON.parse(raw);
    }
    catch {
        return undefined;
    }
    if (!signal.at || signal.at <= since) {
        return undefined;
    }
    try {
        await fs.unlink(target);
    }
    catch {
        // already consumed
    }
    return signal;
}
