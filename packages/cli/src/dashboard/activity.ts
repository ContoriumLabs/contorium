import {
  bumpWorkspaceActivity,
  type AdapterKind,
  type WorkspaceActivityKind,
} from '@contora/state-core';
import { ensureDashboardWorker } from './ensure.js';
import { isDashboardWorkerRunning } from './daemon.js';
import { shouldPreferOsTerminal } from './spawn.js';
import { readDashboardStatus } from './statusFile.js';
import { writeDashboardSession } from './session.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPassiveLine(workspaceRoot: string, timeoutMs = 2000): Promise<string | undefined> {
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
export async function echoPassiveLine(workspaceRoot: string): Promise<void> {
  if (!process.stderr.isTTY) {
    return;
  }
  const line = await waitForPassiveLine(workspaceRoot);
  if (line) {
    process.stderr.write(`\x1b[2m${line}\x1b[0m\n`);
  }
}

export interface WakeOptions {
  kind?: WorkspaceActivityKind;
  detail?: string;
  echoPassive?: boolean;
}

/**
 * Universal activity trigger: file/function/git/event change → light background worker + Passive.
 * Called from IDE (spawn), MCP (reactive sync), CLI (sync), never from show/hide/filter.
 */
export async function wakeDashboardOnActivity(
  workspaceRoot: string,
  source: AdapterKind,
  options?: WakeOptions,
): Promise<{ started: boolean; alreadyRunning: boolean }> {
  await bumpWorkspaceActivity(workspaceRoot, {
    source,
    kind: options?.kind ?? 'file_change',
    detail: options?.detail,
  });
  await writeDashboardSession(workspaceRoot, source, true);

  // MCP bootstrap owns the single dashboard terminal — wake never spawns another window.
  if (source === 'mcp') {
    return {
      started: false,
      alreadyRunning: await isDashboardWorkerRunning(workspaceRoot),
    };
  }

  const workerSource = source === 'ide' ? 'cli' : 'cli';
  const result = await ensureDashboardWorker(workspaceRoot, workerSource, {
    preferTerminal: shouldPreferOsTerminal(),
  });

  return result;
}
