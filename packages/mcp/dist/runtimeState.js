import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readStateJson, readWorkspaceStatus } from './understanding.js';
async function readJsonFile(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
/** Standard MCP tool: worker / session / bootstrap view (read-only). */
export async function readRuntimeState(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const contora = path.join(root, '.contora');
    const [bootstrap, dashboard, session, status, state] = await Promise.all([
        readJsonFile(path.join(contora, 'runtime.bootstrap.json')),
        readJsonFile(path.join(contora, 'dashboard.status.json')),
        readJsonFile(path.join(contora, 'dashboard.session.json')),
        readWorkspaceStatus(root),
        readStateJson(root),
    ]);
    return {
        workspaceRoot: root,
        bootstrap,
        dashboard,
        session,
        stateSummary: {
            mode: status.mode,
            currentTask: status.currentTask,
            lastWriter: state?.source?.lastWriter,
            eventCount: status.eventCount,
        },
    };
}
