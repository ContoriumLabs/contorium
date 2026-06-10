import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface DashboardStatusFile {
  mode: 'idle' | 'passive' | 'expanded' | 'mode_panel';
  line: string;
  frame?: string;
  updateCount: number;
  at: number;
}

function statusPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.contora', 'dashboard.status.json');
}

export async function writeDashboardStatus(
  workspaceRoot: string,
  payload: DashboardStatusFile,
): Promise<void> {
  const target = statusPath(workspaceRoot);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
}

export async function readDashboardStatus(
  workspaceRoot: string,
): Promise<DashboardStatusFile | undefined> {
  try {
    const raw = await fs.readFile(statusPath(workspaceRoot), 'utf8');
    return JSON.parse(raw) as DashboardStatusFile;
  } catch {
    return undefined;
  }
}
