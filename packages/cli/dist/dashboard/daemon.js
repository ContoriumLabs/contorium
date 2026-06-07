import * as fs from 'node:fs/promises';
import * as path from 'node:path';
function pidPath(workspaceRoot) {
    return path.join(workspaceRoot, '.contora', 'dashboard.pid');
}
export async function registerDashboardWorker(workspaceRoot) {
    await fs.mkdir(path.join(workspaceRoot, '.contora'), { recursive: true });
    await fs.writeFile(pidPath(workspaceRoot), String(process.pid), 'utf8');
}
export async function unregisterDashboardWorker(workspaceRoot) {
    try {
        await fs.unlink(pidPath(workspaceRoot));
    }
    catch {
        // ignore
    }
}
export async function isDashboardWorkerRunning(workspaceRoot) {
    let pid = 0;
    try {
        const raw = await fs.readFile(pidPath(workspaceRoot), 'utf8');
        pid = Number(raw.trim());
    }
    catch {
        return false;
    }
    if (!Number.isFinite(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        await unregisterDashboardWorker(workspaceRoot);
        return false;
    }
}
