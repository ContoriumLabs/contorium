import * as fs from 'node:fs/promises';
import * as path from 'node:path';
function statusPath(workspaceRoot) {
    return path.join(workspaceRoot, '.contora', 'dashboard.status.json');
}
export async function writeDashboardStatus(workspaceRoot, payload) {
    const target = statusPath(workspaceRoot);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
}
export async function readDashboardStatus(workspaceRoot) {
    try {
        const raw = await fs.readFile(statusPath(workspaceRoot), 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
