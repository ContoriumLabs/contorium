import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { bumpWorkspaceActivity, syncWorkspaceState, } from '@contora/state-core';
import { isDashboardWorkerRunning } from '../dashboard/daemon.js';
import { ensureDashboardWorker } from '../dashboard/ensure.js';
/**
 * Contorium Runtime Bootstrap — unified attach for IDE / MCP / CLI.
 * MCP initialize → this runs (not deferred to first file change).
 */
export async function bootstrapContoriumRuntime(workspaceRoot, source) {
    const root = path.resolve(workspaceRoot);
    await syncWorkspaceState(root, source);
    await bumpWorkspaceActivity(root, {
        source,
        kind: 'sync',
        detail: 'bootstrap',
    });
    const alreadyRunning = await isDashboardWorkerRunning(root);
    if (!alreadyRunning) {
        const workerSource = source === 'mcp' ? 'mcp' : 'cli';
        await ensureDashboardWorker(root, workerSource, { preferTerminal: true });
    }
    const response = {
        status: 'ok',
        runtime_id: `ctr-${Date.now().toString(36)}`,
        mode: alreadyRunning ? 'already_running' : 'attached',
        state: 'passive',
        source,
        workspaceRoot: root,
        features: {
            file_watch: true,
            ast_diff: true,
            agent_stream: true,
        },
    };
    const artifact = path.join(root, '.contora', 'runtime.bootstrap.json');
    await fs.mkdir(path.dirname(artifact), { recursive: true });
    await fs.writeFile(artifact, JSON.stringify({ ...response, at: Date.now() }, null, 2), 'utf8');
    return response;
}
