import * as fs from 'fs/promises';
import * as path from 'path';

export async function writeDashboardSignal(
  workspaceRoot: string,
  action: 'expand' | 'minimize' | 'filter' | 'clear-filter',
  filter?: string,
): Promise<void> {
  const target = path.join(workspaceRoot, '.contora', 'dashboard.signal.json');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(
    target,
    JSON.stringify({ action, filter, at: Date.now() }, null, 2),
    'utf8',
  );
}
