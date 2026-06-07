import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface DashboardSessionMarker {
  active: boolean;
  startedAt: number;
  source: 'ide' | 'cli' | 'mcp';
  workspaceRoot: string;
}

function sessionPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.contora', 'dashboard.session.json');
}

export async function writeDashboardSession(
  workspaceRoot: string,
  source: DashboardSessionMarker['source'],
  active = true,
): Promise<void> {
  const payload: DashboardSessionMarker = {
    active,
    startedAt: Date.now(),
    source,
    workspaceRoot,
  };
  const target = sessionPath(workspaceRoot);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
}

export async function readDashboardSession(
  workspaceRoot: string,
): Promise<DashboardSessionMarker | undefined> {
  try {
    const raw = await fs.readFile(sessionPath(workspaceRoot), 'utf8');
    return JSON.parse(raw) as DashboardSessionMarker;
  } catch {
    return undefined;
  }
}
