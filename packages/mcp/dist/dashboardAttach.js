import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { bumpWorkspaceActivity } from '@contora/state-core';
import { resolveContoriumCliBinary } from './cliResolve.js';
function quoteBatPath(value) {
    return `"${value.replace(/"/g, '""')}"`;
}
function spawnHiddenNode(args, cwd) {
    const flags = process.platform === 'win32' ? { creationFlags: 0x08000000 } : {};
    spawn(process.execPath, args, {
        cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: false,
        ...flags,
    }).unref();
}
/** Spawn minimized Contorium Dashboard — one window, no npm/npx. */
export function spawnDashboardWindow(workspaceRoot) {
    const cli = resolveContoriumCliBinary();
    if (!cli) {
        console.error('[contorium-mcp] CLI not found — set CONTORIUM_CLI_PATH or use local node MCP (not npx). See commands/setup-mcp-codex.md');
        return false;
    }
    const root = path.resolve(workspaceRoot);
    const contoraDir = path.join(root, '.contora');
    fs.mkdirSync(contoraDir, { recursive: true });
    const batPath = path.join(contoraDir, 'dashboard.cmd');
    const vbsPath = path.join(contoraDir, 'dashboard-launch.vbs');
    const node = process.execPath;
    const bat = [
        '@echo off',
        'title Contorium Dashboard',
        `cd /d ${quoteBatPath(root)}`,
        `${quoteBatPath(node)} ${quoteBatPath(cli)} attach ${quoteBatPath(root)} --auto`,
        'if errorlevel 1 pause',
    ].join('\r\n');
    fs.writeFileSync(batPath, `${bat}\r\n`, 'utf8');
    if (process.platform === 'win32') {
        const batForVbs = batPath.replace(/"/g, '""');
        const vbs = [
            'Set shell = CreateObject("Wscript.Shell")',
            `shell.Run "cmd /k call ""${batForVbs}""", 2, False`,
        ].join('\r\n');
        fs.writeFileSync(vbsPath, `${vbs}\r\n`, 'utf8');
        spawn('wscript.exe', ['//Nologo', vbsPath], {
            cwd: root,
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
            shell: false,
        }).unref();
        return true;
    }
    spawnHiddenNode([cli, 'attach', root, '--auto'], root);
    return true;
}
/** Fallback attach when CLI dist import unavailable (published npm / npx MCP). */
export async function attachDashboardFallback(workspaceRoot) {
    await bumpWorkspaceActivity(workspaceRoot, {
        source: 'mcp',
        kind: 'sync',
        detail: 'mcp-dashboard-attach',
    });
    spawnDashboardWindow(workspaceRoot);
}
