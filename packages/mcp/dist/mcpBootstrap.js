import * as fs from 'node:fs';
import * as path from 'node:path';
import { readWorkspaceActivity, setGitSubprocessAllowed, syncWorkspaceState, } from '@contora/state-core';
import { releaseMcpWorkspaceLock, tryClaimMcpWorkspaceLock } from './mcpLock.js';
import { scheduleMcpDashboardWake } from './dashboardEnsure.js';
import { checkActiveRuntime, confirmHandoffInjection, readHandoffInjectionState, syncInjectionWithRuntime, } from '@contora/state-core';
const CONTORA_EVENTS = '.contora/events';
const SYNC_MS = 60_000;
const DEBOUNCE_MS = 400;
/** Ignore reactive sync burst while MCP init + dashboard attach runs. */
const STARTUP_QUIET_MS = 30_000;
let syncTimer;
let debounceTimer;
let eventsWatcher;
let workspaceWatcher;
let gitHeadWatcher;
let lightSyncStartedAt = 0;
let gitHeadWatchReady = false;
let mcpLockHeld = false;
let mcpLockRoot;
const IDE_ACTIVITY_QUIET_MS = 10_000;
function shouldIgnoreWorkspaceWatch(filename) {
    const n = filename.replace(/\\/g, '/');
    if (!n) {
        return true;
    }
    if (n.includes('node_modules/') ||
        n.includes('.git/') ||
        n.includes('.contora/') ||
        n.endsWith('.log') ||
        n.endsWith('.tmp')) {
        return true;
    }
    return false;
}
async function shouldDeferMcpReactiveSideEffects(workspaceRoot) {
    const activity = await readWorkspaceActivity(workspaceRoot);
    return (activity?.source === 'ide' &&
        Date.now() - activity.at < IDE_ACTIVITY_QUIET_MS);
}
function scheduleReactiveSync(workspaceRoot, opts) {
    if (Date.now() - lightSyncStartedAt < STARTUP_QUIET_MS) {
        return;
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        if (opts?.refreshGit) {
            setGitSubprocessAllowed(true);
        }
        void syncWorkspaceState(workspaceRoot, 'mcp', {
            refreshGit: opts?.refreshGit === true,
            gitStatusOnly: opts?.refreshGit === true,
        })
            .then(async () => {
            if (await shouldDeferMcpReactiveSideEffects(workspaceRoot)) {
                return;
            }
            scheduleMcpDashboardWake(workspaceRoot, 'mcp-reactive-sync');
            await syncInjectionWithRuntime(workspaceRoot);
            const { runtime_id } = await checkActiveRuntime(workspaceRoot);
            const injection = await readHandoffInjectionState(workspaceRoot);
            if (runtime_id &&
                injection?.runtime_id === runtime_id &&
                injection.status === 'injected') {
                await confirmHandoffInjection(workspaceRoot, injection.format ?? 'markdown');
            }
        })
            .catch(() => undefined);
    }, DEBOUNCE_MS);
}
/** MCP startup bootstrap — no git.exe (uses cached state.json git fields). */
export async function ensureWorkspaceBootstrapped(workspaceRoot) {
    setGitSubprocessAllowed(false);
    const result = await syncWorkspaceState(workspaceRoot, 'mcp', {
        skipGitScan: true,
    });
    if (result.created) {
        console.error('[contorium-mcp] bootstrap: created .contora/state.json (scan-driven)');
    }
    return { bootstrapped: result.created, mode: result.mode };
}
/** Light sync: poll + watch — git only after startup quiet window on HEAD change. */
export function startMcpLightSync(workspaceRoot) {
    stopMcpLightSync();
    setGitSubprocessAllowed(false);
    const root = path.resolve(workspaceRoot);
    mcpLockHeld = tryClaimMcpWorkspaceLock(root);
    if (!mcpLockHeld) {
        console.error('[contorium-mcp] light sync skipped — another MCP server owns this workspace');
        return false;
    }
    mcpLockRoot = root;
    lightSyncStartedAt = Date.now();
    gitHeadWatchReady = false;
    syncTimer = setInterval(() => {
        if (Date.now() - lightSyncStartedAt < STARTUP_QUIET_MS) {
            return;
        }
        void syncWorkspaceState(root, 'mcp', { skipGitScan: true }).catch(() => undefined);
    }, SYNC_MS);
    syncTimer.unref?.();
    const eventsDir = path.join(root, CONTORA_EVENTS);
    try {
        fs.mkdirSync(eventsDir, { recursive: true });
        eventsWatcher = fs.watch(eventsDir, () => scheduleReactiveSync(root));
        eventsWatcher.unref?.();
    }
    catch {
        /* optional */
    }
    try {
        workspaceWatcher = fs.watch(root, { recursive: true }, (_event, filename) => {
            if (!filename || shouldIgnoreWorkspaceWatch(filename)) {
                return;
            }
            scheduleReactiveSync(root);
        });
        workspaceWatcher.unref?.();
    }
    catch {
        /* recursive watch unavailable */
    }
    const gitHead = path.join(root, '.git', 'HEAD');
    try {
        gitHeadWatcher = fs.watch(gitHead, () => {
            if (!gitHeadWatchReady) {
                return;
            }
            scheduleReactiveSync(root, { refreshGit: true });
        });
        gitHeadWatcher.unref?.();
        setTimeout(() => {
            gitHeadWatchReady = true;
        }, STARTUP_QUIET_MS).unref?.();
    }
    catch {
        /* not a git repo */
    }
    return true;
}
export function stopMcpLightSync() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = undefined;
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
    }
    eventsWatcher?.close();
    eventsWatcher = undefined;
    workspaceWatcher?.close();
    workspaceWatcher = undefined;
    gitHeadWatcher?.close();
    gitHeadWatcher = undefined;
    gitHeadWatchReady = false;
    if (mcpLockHeld && mcpLockRoot) {
        releaseMcpWorkspaceLock(mcpLockRoot);
        mcpLockHeld = false;
        mcpLockRoot = undefined;
    }
}
