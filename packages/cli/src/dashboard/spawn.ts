import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveContoriumCli(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../bin/contorium.cjs');
}

function spawnDetached(node: string, args: string[], cwd: string): void {
  const child = spawn(node, args, {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

/** Spawn a low-presence OS terminal tab/window running the dashboard worker. */
export function spawnDashboardTerminal(workspaceRoot: string, cliScript?: string): void {
  const cli = cliScript ?? resolveContoriumCli();
  const root = path.resolve(workspaceRoot);
  const node = process.execPath;
  const attachArgs = [cli, 'attach', '.', '--auto'];

  if (process.platform === 'win32') {
    const inner = `${JSON.stringify(node)} ${attachArgs.map((a) => JSON.stringify(a)).join(' ')}`;
    spawn('cmd.exe', ['/c', 'start', '/min', 'Contorium Dashboard', 'cmd', '/k', inner], {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
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
export function spawnHeadlessWorker(workspaceRoot: string, cliScript?: string): void {
  const cli = cliScript ?? resolveContoriumCli();
  spawnDetached(process.execPath, [cli, 'attach', path.resolve(workspaceRoot), '--auto', '--headless'], workspaceRoot);
}

export function shouldPreferOsTerminal(): boolean {
  if (process.env.CONTORIUM_DASHBOARD_TERMINAL === '0') {
    return false;
  }
  if (process.env.CONTORIUM_DASHBOARD_TERMINAL === '1') {
    return true;
  }
  return process.platform === 'win32' || process.platform === 'darwin';
}
