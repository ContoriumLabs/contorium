import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AdapterKind } from './types.js';

export type WorkspaceActivityKind =
  | 'file_change'
  | 'function_change'
  | 'git_change'
  | 'sync'
  | 'event';

export interface WorkspaceActivityBump {
  at: number;
  source: AdapterKind;
  kind: WorkspaceActivityKind;
  detail?: string;
}

function activityPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.contora', 'dashboard.activity.json');
}

/** Record workspace activity — universal trigger for dashboard auto-attach (IDE / MCP / CLI). */
export async function bumpWorkspaceActivity(
  workspaceRoot: string,
  bump: Omit<WorkspaceActivityBump, 'at'>,
): Promise<void> {
  const payload: WorkspaceActivityBump = { ...bump, at: Date.now() };
  const target = activityPath(path.resolve(workspaceRoot));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
}

export async function readWorkspaceActivity(
  workspaceRoot: string,
): Promise<WorkspaceActivityBump | undefined> {
  try {
    const raw = await fs.readFile(activityPath(path.resolve(workspaceRoot)), 'utf8');
    return JSON.parse(raw) as WorkspaceActivityBump;
  } catch {
    return undefined;
  }
}
