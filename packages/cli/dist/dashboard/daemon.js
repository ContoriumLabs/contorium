import * as fs from 'node:fs/promises';
import * as path from 'node:path';
function pidPath(workspaceRoot) {
    return path.join(workspaceRoot, '.contora', 'dashboard.pid');
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
export async function readDashboardWorkerPid(workspaceRoot) {
    try {
        const raw = await fs.readFile(pidPath(workspaceRoot), 'utf8');
        const pid = Number(raw.trim());
        return Number.isFinite(pid) && pid > 0 ? pid : undefined;
    }
    catch {
        return undefined;
    }
}
export async function isDashboardWorkerRunning(workspaceRoot) {
    const pid = await readDashboardWorkerPid(workspaceRoot);
    if (!pid) {
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
/** Atomically claim dashboard worker slot (prevents two attach terminals on Windows). */
export async function tryClaimDashboardWorker(workspaceRoot) {
    const fp = pidPath(workspaceRoot);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    try {
        const fh = await fs.open(fp, 'wx');
        await fh.writeFile(String(process.pid), 'utf8');
        await fh.close();
        return true;
    }
    catch (err) {
        const code = err.code;
        if (code !== 'EEXIST') {
            throw err;
        }
        if (!(await isDashboardWorkerRunning(workspaceRoot))) {
            await unregisterDashboardWorker(workspaceRoot);
            return tryClaimDashboardWorker(workspaceRoot);
        }
        return false;
    }
}
/** Stop background/headless worker before reopening a visible dashboard terminal. */
export async function stopDashboardWorker(workspaceRoot) {
    const pid = await readDashboardWorkerPid(workspaceRoot);
    if (pid) {
        try {
            process.kill(pid, 'SIGTERM');
        }
        catch {
            // already dead
        }
        await sleep(400);
        if (await isDashboardWorkerRunning(workspaceRoot)) {
            try {
                process.kill(pid, 'SIGKILL');
            }
            catch {
                // ignore
            }
            await sleep(200);
        }
    }
    await unregisterDashboardWorker(workspaceRoot);
}
