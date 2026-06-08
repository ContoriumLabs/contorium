import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveContoriumCliBinary } from './cliResolve.js';

export interface CliSpawnPlan {
  command: string;
  args: string[];
}

/** Resolve contorium CLI spawn plan — node + .cjs only (never npx/npm exec). */
export function resolveContoriumSpawn(
  subcommand: string,
  workspaceRoot: string,
  extraArgs: string[] = [],
): CliSpawnPlan | undefined {
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

function spawnDetached(plan: CliSpawnPlan): void {
  const flags = process.platform === 'win32' ? { creationFlags: 0x08000000 } : {};
  spawn(plan.command, plan.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: false,
    ...flags,
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

/** @deprecated Use ensureMcpDashboardAttached — kept for legacy callers. */
export function scheduleMcpRuntimeBootstrap(workspaceRoot: string): void {
  scheduleOncePerWorkspace(bootstrapScheduled, workspaceRoot, 60_000, () => {
    const plan = resolveContoriumSpawn('bootstrap', workspaceRoot, ['--source', 'mcp', '--quiet']);
    if (plan) {
      spawnDetached(plan);
    } else {
      console.error('[contorium-mcp] bootstrap skipped: CLI not found (do not use npx for MCP server)');
    }
  });
}

/** Activity update after bootstrap (file/git events). */
export function scheduleMcpDashboardWake(workspaceRoot: string, detail?: string): void {
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
