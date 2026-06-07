import { bumpWorkspaceActivity, } from '@contora/state-core';
import { ensureDashboardWorker } from './ensure.js';
import { readDashboardStatus } from './statusFile.js';
import { writeDashboardSession } from './session.js';
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForPassiveLine(workspaceRoot, timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const status = await readDashboardStatus(workspaceRoot);
        if (status?.line && status.mode !== 'idle') {
            return status.line;
        }
        await sleep(120);
    }
    return undefined;
}
/** Echo Passive line to stderr (low-interference, current terminal). */
export async function echoPassiveLine(workspaceRoot) {
    if (!process.stderr.isTTY) {
        return;
    }
    const line = await waitForPassiveLine(workspaceRoot);
    if (line) {
        process.stderr.write(`\x1b[2m${line}\x1b[0m\n`);
    }
}
/**
 * Universal activity trigger: file/function/git/event change → light background worker + Passive.
 * Called from IDE (spawn), MCP (reactive sync), CLI (sync), never from show/hide/filter.
 */
export async function wakeDashboardOnActivity(workspaceRoot, source, options) {
    await bumpWorkspaceActivity(workspaceRoot, {
        source,
        kind: options?.kind ?? 'file_change',
        detail: options?.detail,
    });
    await writeDashboardSession(workspaceRoot, source, true);
    const mcpOrCli = source === 'mcp' ? 'mcp' : 'cli';
    const result = await ensureDashboardWorker(workspaceRoot, mcpOrCli, {
        preferTerminal: true,
    });
    return result;
}
