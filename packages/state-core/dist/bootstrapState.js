import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const CONTORA_DIR = '.contora';
function newSessionId() {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
export function bootstrapStateFromScan(scan) {
    return {
        sessionId: newSessionId(),
        currentTask: '',
        openFiles: scan.recentFiles.slice(0, 8),
        recentFiles: scan.recentFiles.slice(0, 24),
        gitStaged: scan.gitStaged,
        gitWorking: scan.gitWorking,
        notes: '',
        lastUpdated: scan.scannedAt,
    };
}
export async function readStateJson(workspaceRoot) {
    const fp = path.join(workspaceRoot, CONTORA_DIR, 'state.json');
    try {
        const text = await fs.readFile(fp, 'utf8');
        const o = JSON.parse(text);
        return {
            sessionId: typeof o.sessionId === 'string' ? o.sessionId : newSessionId(),
            currentTask: typeof o.currentTask === 'string' ? o.currentTask : '',
            openFiles: Array.isArray(o.openFiles)
                ? o.openFiles.filter((x) => typeof x === 'string')
                : [],
            recentFiles: Array.isArray(o.recentFiles)
                ? o.recentFiles.filter((x) => typeof x === 'string')
                : [],
            gitStaged: Array.isArray(o.gitStaged)
                ? o.gitStaged.filter((x) => typeof x === 'string')
                : [],
            gitWorking: Array.isArray(o.gitWorking)
                ? o.gitWorking.filter((x) => typeof x === 'string')
                : [],
            notes: typeof o.notes === 'string' ? o.notes : '',
            lastUpdated: typeof o.lastUpdated === 'number' ? o.lastUpdated : 0,
        };
    }
    catch {
        return null;
    }
}
export async function writeStateJson(workspaceRoot, state) {
    const dir = path.join(workspaceRoot, CONTORA_DIR);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
}
export async function stateJsonExists(workspaceRoot) {
    try {
        await fs.access(path.join(workspaceRoot, CONTORA_DIR, 'state.json'));
        return true;
    }
    catch {
        return false;
    }
}
