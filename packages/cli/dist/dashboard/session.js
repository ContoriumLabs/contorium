import * as fs from 'node:fs/promises';
import * as path from 'node:path';
function sessionPath(workspaceRoot) {
    return path.join(workspaceRoot, '.contora', 'dashboard.session.json');
}
export async function writeDashboardSession(workspaceRoot, source, active = true) {
    const payload = {
        active,
        startedAt: Date.now(),
        source,
        workspaceRoot,
    };
    const target = sessionPath(workspaceRoot);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
}
export async function readDashboardSession(workspaceRoot) {
    try {
        const raw = await fs.readFile(sessionPath(workspaceRoot), 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
