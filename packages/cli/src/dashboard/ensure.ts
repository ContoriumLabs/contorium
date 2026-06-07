import { isDashboardWorkerRunning } from './daemon.js';
import { shouldPreferOsTerminal, spawnDashboardTerminal, spawnHeadlessWorker } from './spawn.js';
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
  source: 'mcp' | 'cli',
  opts?: { preferTerminal?: boolean },
): Promise<EnsureResult> {
  if (await isDashboardWorkerRunning(workspaceRoot)) {
    return { started: false, alreadyRunning: true };
  }

  await writeDashboardSession(workspaceRoot, source, true);

  const preferTerminal = opts?.preferTerminal ?? shouldPreferOsTerminal();
  if (preferTerminal) {
    spawnDashboardTerminal(workspaceRoot);
  } else {
    spawnHeadlessWorker(workspaceRoot);
  }

  return { started: true, alreadyRunning: false };
}
