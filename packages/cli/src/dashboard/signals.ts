import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DashboardSignal, DashboardSignalAction } from './types.js';

function signalPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.contora', 'dashboard.signal.json');
}

export async function writeDashboardSignal(
  workspaceRoot: string,
  action: DashboardSignalAction,
  filter?: string,
): Promise<void> {
  const payload: DashboardSignal = { action, filter, at: Date.now() };
  const target = signalPath(workspaceRoot);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
}

/** Read and clear signal if newer than `since`. */
export async function consumeDashboardSignal(
  workspaceRoot: string,
  since: number,
): Promise<DashboardSignal | undefined> {
  const target = signalPath(workspaceRoot);
  let raw: string;
  try {
    raw = await fs.readFile(target, 'utf8');
  } catch {
    return undefined;
  }

  let signal: DashboardSignal;
  try {
    signal = JSON.parse(raw) as DashboardSignal;
  } catch {
    return undefined;
  }

  if (!signal.at || signal.at <= since) {
    return undefined;
  }

  try {
    await fs.unlink(target);
  } catch {
    // already consumed
  }
  return signal;
}
