import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
export function resolveContoriumCli() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, '../../bin/contorium.cjs');
}
function quoteBatPath(value) {
    return `"${value.replace(/"/g, '""')}"`;
}
function spawnDetached(node, args, cwd) {
    const child = spawn(node, args, {
        cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });
    child.unref();
}
/**
 * Windows: one minimized dashboard console via WScript (no flash, no extra bootstrap window).
 */
function spawnWindowsDashboardBatch(workspaceRoot, cli, node) {
    const root = path.resolve(workspaceRoot);
    const contoraDir = path.join(root, '.contora');
    fs.mkdirSync(contoraDir, { recursive: true });
    const batPath = path.join(contoraDir, 'dashboard.cmd');
    const vbsPath = path.join(contoraDir, 'dashboard-launch.vbs');
    const bat = [
        '@echo off',
        'title Contorium Dashboard',
        `cd /d ${quoteBatPath(root)}`,
        `${quoteBatPath(node)} ${quoteBatPath(cli)} attach ${quoteBatPath(root)} --auto`,
        'if errorlevel 1 (',
        '  echo.',
        '  echo [contorium] Dashboard exited with error',
        '  pause',
        ')',
    ].join('\r\n');
    fs.writeFileSync(batPath, `${bat}\r\n`, 'utf8');
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
    }).unref();
}
/** Spawn a visible OS terminal running the dashboard worker. */
export function spawnDashboardTerminal(workspaceRoot, cliScript) {
    const cli = cliScript ?? resolveContoriumCli();
    const root = path.resolve(workspaceRoot);
    const node = process.execPath;
    const attachArgs = [cli, 'attach', root, '--auto'];
    if (process.platform === 'win32') {
        if (!fs.existsSync(cli)) {
            process.stderr.write(`[contorium] CLI missing: ${cli}\n`);
            spawnHeadlessWorker(workspaceRoot, cliScript);
            return;
        }
        spawnWindowsDashboardBatch(root, cli, node);
        return;
    }
    if (process.platform === 'darwin') {
        const script = `cd ${JSON.stringify(root)} && ${JSON.stringify(node)} ${attachArgs.map((a) => JSON.stringify(a)).join(' ')}`;
        spawn('osascript', [
            '-e',
            `tell application "Terminal" to do script "${script.replace(/"/g, '\\"')}"`,
        ], { detached: true, stdio: 'ignore' }).unref();
        return;
    }
    spawnHeadlessWorker(workspaceRoot, cli);
}
/** Background worker without a visible terminal (writes .contora/dashboard.status.json). */
export function spawnHeadlessWorker(workspaceRoot, cliScript) {
    const cli = cliScript ?? resolveContoriumCli();
    if (!fs.existsSync(cli)) {
        return;
    }
    spawnDetached(process.execPath, [cli, 'attach', path.resolve(workspaceRoot), '--auto', '--headless'], workspaceRoot);
}
/** Visible OS terminal on Windows/macOS unless CONTORIUM_DASHBOARD_TERMINAL=0. */
export function shouldPreferOsTerminal() {
    if (process.env.CONTORIUM_DASHBOARD_TERMINAL === '0') {
        return false;
    }
    if (process.env.CONTORIUM_DASHBOARD_TERMINAL === '1') {
        return true;
    }
    return process.platform === 'win32' || process.platform === 'darwin';
}
