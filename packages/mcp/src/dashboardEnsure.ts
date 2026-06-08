import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CliSpawnPlan {
  command: string;
  args: string[];
}

/** Resolve contorium CLI for bootstrap/wake — monorepo dev, bundled helper, or npx fallback. */
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

  if (subcommand === 'bootstrap') {
    const helper = path.resolve(here, '../bin/mcp-dashboard-bootstrap.cjs');
    if (fs.existsSync(helper)) {
      return {
        command: process.execPath,
        args: [helper, root],
      };
    }
  }

  const envCli = process.env.CONTORIUM_CLI_PATH;
  if (envCli && fs.existsSync(envCli)) {
    return {
      command: process.execPath,
      args: [envCli, subcommand, root, ...extraArgs],
    };
  }

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['contorium', subcommand, root, ...extraArgs],
  };
}

function spawnDetached(plan: CliSpawnPlan): void {
  spawn(plan.command, plan.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: false,
  }).unref();
}

const bootstrapScheduled = new Set<string>();
const wakeScheduled = new Set<string>();

function scheduleOncePerWorkspace(
  bucket: Set<string>,
  workspaceRoot: string,
  ttlMs: number,
  run: () => void,
): void {
  const root = path.resolve(workspaceRoot);
  if (bucket.has(root)) {
    return;
  }
  bucket.add(root);
  setTimeout(() => bucket.delete(root), ttlMs);
  run();
}

/** CRBP — MCP client initialize → bootstrap runtime attach. */
export function scheduleMcpRuntimeBootstrap(workspaceRoot: string): void {
  scheduleOncePerWorkspace(bootstrapScheduled, workspaceRoot, 60_000, () => {
    spawnDetached(resolveContoriumSpawn('bootstrap', workspaceRoot, ['--source', 'mcp', '--quiet']));
  });
}

/** Activity update after bootstrap (file/git events). */
export function scheduleMcpDashboardWake(workspaceRoot: string, detail?: string): void {
  scheduleOncePerWorkspace(wakeScheduled, workspaceRoot, 8_000, () => {
    const extra = ['--source', 'mcp'];
    if (detail) {
      extra.push('--detail', detail);
    }
    spawnDetached(resolveContoriumSpawn('dashboard', workspaceRoot, ['wake', ...extra]));
  });
}
