import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveContoriumCliBinary } from './cliResolve.js';
/** Resolve contorium CLI spawn plan — node + .cjs only (never npx/npm exec). */
export function resolveContoriumSpawn(subcommand, workspaceRoot, extraArgs = []) {
    const root = path.resolve(workspaceRoot);
    const cli = resolveContoriumCliBinary();
    if (cli) {
        return {
            command: process.execPath,
            args: [cli, subcommand, root, ...extraArgs],
        };
    }
    if (subcommand === 'bootstrap') {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const helper = path.resolve(here, '../bin/mcp-dashboard-bootstrap.cjs');
        if (fs.existsSync(helper)) {
            return {
                command: process.execPath,
                args: [helper, root],
            };
        }
    }
    return undefined;
}
function spawnDetached(plan) {
    const flags = process.platform === 'win32' ? { creationFlags: 0x08000000 } : {};
    spawn(plan.command, plan.args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: false,
        ...flags,
    }).unref();
}
const bootstrapScheduled = new Set();
const wakeScheduled = new Set();
function scheduleOncePerWorkspace(bucket, workspaceRoot, ttlMs, run) {
    const root = path.resolve(workspaceRoot);
    if (bucket.has(root)) {
        return;
    }
    bucket.add(root);
    setTimeout(() => bucket.delete(root), ttlMs);
    run();
}
/** @deprecated Use ensureMcpDashboardAttached — kept for legacy callers. */
export function scheduleMcpRuntimeBootstrap(workspaceRoot) {
    scheduleOncePerWorkspace(bootstrapScheduled, workspaceRoot, 60_000, () => {
        const plan = resolveContoriumSpawn('bootstrap', workspaceRoot, ['--source', 'mcp', '--quiet']);
        if (plan) {
            spawnDetached(plan);
        }
        else {
            console.error('[contorium-mcp] bootstrap skipped: CLI not found (do not use npx for MCP server)');
        }
    });
}
/** Activity update after bootstrap (file/git events). */
export function scheduleMcpDashboardWake(workspaceRoot, detail) {
    scheduleOncePerWorkspace(wakeScheduled, workspaceRoot, 8_000, () => {
        const extra = ['--source', 'mcp'];
        if (detail) {
            extra.push('--detail', detail);
        }
        const plan = resolveContoriumSpawn('dashboard', workspaceRoot, ['wake', ...extra]);
        if (plan) {
            spawnDetached(plan);
        }
    });
}
