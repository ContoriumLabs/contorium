import { isDashboardWorkerRunning } from './daemon.js';
import { shouldPreferOsTerminal, spawnDashboardTerminal, spawnHeadlessWorker } from './spawn.js';
import { isDashboardSpawnPending, tryAcquireDashboardSpawnLock } from './spawnLock.js';
import { writeDashboardSession } from './session.js';

export interface EnsureResult {
  started: boolean;
  alreadyRunning: boolean;
}

/**
 * Idempotent auto-attach for MCP / Codex / CLI (not IDE — IDE uses its own terminal tab).
 */
export async function ensureDashboardWorker(
  workspaceRoot: string,
  source: 'mcp' | 'cli' | 'ide',
  opts?: { preferTerminal?: boolean },
): Promise<EnsureResult> {
  if (await isDashboardWorkerRunning(workspaceRoot)) {
    return { started: false, alreadyRunning: true };
  }

  if (await isDashboardSpawnPending(workspaceRoot)) {
    return { started: false, alreadyRunning: true };
  }

  if (!(await tryAcquireDashboardSpawnLock(workspaceRoot))) {
    return { started: false, alreadyRunning: true };
  }

  await writeDashboardSession(workspaceRoot, source, true);

  const preferTerminal = opts?.preferTerminal ?? shouldPreferOsTerminal();
  if (preferTerminal) {
    spawnDashboardTerminal(workspaceRoot);
  } else {
    spawnHeadlessWorker(workspaceRoot);
  }

  // Lock released by attach after registerDashboardWorker — not here (race caused Codex flash-close).
  return { started: true, alreadyRunning: false };
}
