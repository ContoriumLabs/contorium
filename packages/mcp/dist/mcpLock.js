import * as fs from 'node:fs';
import * as path from 'node:path';
function lockPath(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), '.contora', 'mcp.lock');
}
function readLockPid(workspaceRoot) {
    try {
        const raw = fs.readFileSync(lockPath(workspaceRoot), 'utf8');
        const pid = Number(raw.trim().split(':')[0]);
        return Number.isFinite(pid) && pid > 0 ? pid : undefined;
    }
    catch {
        return undefined;
    }
}
function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
/** One MCP stdio server per workspace — second instance skips light sync side effects. */
export function tryClaimMcpWorkspaceLock(workspaceRoot) {
    const fp = lockPath(workspaceRoot);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    const existing = readLockPid(workspaceRoot);
    if (existing && existing !== process.pid && isPidAlive(existing)) {
        return false;
    }
    try {
        fs.writeFileSync(fp, `${process.pid}:${Date.now()}\n`, 'utf8');
        return true;
    }
    catch {
        return false;
    }
}
export function releaseMcpWorkspaceLock(workspaceRoot) {
    try {
        const fp = lockPath(workspaceRoot);
        const pid = readLockPid(workspaceRoot);
        if (pid === process.pid) {
            fs.unlinkSync(fp);
        }
    }
    catch {
        // ignore
    }
}
