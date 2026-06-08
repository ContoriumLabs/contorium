import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isDashboardWorkerRunning } from './daemon.js';
/** Window spawn → attach register can take several seconds on Windows. */
const LOCK_TTL_MS = 45_000;
function lockPath(workspaceRoot) {
    return path.join(workspaceRoot, '.contora', 'dashboard.spawn.lock');
}
async function lockAgeMs(workspaceRoot) {
    const fp = lockPath(workspaceRoot);
    try {
        const st = await fs.stat(fp);
        return Date.now() - st.mtimeMs;
    }
    catch {
        return undefined;
    }
}
async function clearExpiredSpawnLock(workspaceRoot) {
    const age = await lockAgeMs(workspaceRoot);
    if (age !== undefined && age >= LOCK_TTL_MS) {
        await releaseDashboardSpawnLock(workspaceRoot);
    }
}
/** Prevent double terminal spawn when MCP bootstrap races (Windows flash-close). */
export async function tryAcquireDashboardSpawnLock(workspaceRoot) {
    const fp = lockPath(workspaceRoot);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await clearExpiredSpawnLock(workspaceRoot);
    try {
        const fh = await fs.open(fp, 'wx');
        await fh.writeFile(`${process.pid}:${Date.now()}\n`, 'utf8');
        await fh.close();
        return true;
    }
    catch (err) {
        const code = err.code;
        if (code === 'EEXIST') {
            return false;
        }
        throw err;
    }
}
export async function isDashboardSpawnPending(workspaceRoot) {
    await clearExpiredSpawnLock(workspaceRoot);
    const age = await lockAgeMs(workspaceRoot);
    if (age === undefined || age >= LOCK_TTL_MS) {
        return false;
    }
    if (await isDashboardWorkerRunning(workspaceRoot)) {
        return false;
    }
    return true;
}
export async function releaseDashboardSpawnLock(workspaceRoot) {
    try {
        await fs.unlink(lockPath(workspaceRoot));
    }
    catch {
        // ignore
    }
}
