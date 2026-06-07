import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CliSpawnPlan {
  command: string;
  args: string[];
}

/** Resolve contorium CLI for bootstrap/wake — monorepo dev or global/npx when published. */
export function resolveContoriumSpawn(subcommand: string, workspaceRoot: string, extraArgs: string[] = []): CliSpawnPlan {
  const root = path.resolve(workspaceRoot);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const monorepoCli = path.resolve(here, '../../cli/bin/contorium.cjs');
  if (fs.existsSync(monorepoCli)) {
    return {
      command: process.execPath,
      args: [monorepoCli, subcommand, root, ...extraArgs],
    };
  }
  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['contorium', subcommand, root, ...extraArgs],
  };
}

function spawnDetached(plan: CliSpawnPlan): void {
  const useShell = process.platform === 'win32' && !plan.args[0]?.endsWith('.cjs');
  spawn(plan.command, plan.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: useShell,
  }).unref();
}

/** CRBP — MCP client initialize → bootstrap runtime attach. */
export function scheduleMcpRuntimeBootstrap(workspaceRoot: string): void {
  spawnDetached(resolveContoriumSpawn('bootstrap', workspaceRoot, ['--source', 'mcp']));
}

/** Activity update after bootstrap (file/git events). */
export function scheduleMcpDashboardWake(workspaceRoot: string, detail?: string): void {
  const extra = ['--source', 'mcp'];
  if (detail) {
    extra.push('--detail', detail);
  }
  spawnDetached(resolveContoriumSpawn('dashboard', workspaceRoot, ['wake', ...extra]));
}
