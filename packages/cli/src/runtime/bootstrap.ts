import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  bumpWorkspaceActivity,
  syncWorkspaceState,
  type AdapterKind,
} from '@contora/state-core';
import { isDashboardWorkerRunning, stopDashboardWorker } from '../dashboard/daemon.js';
import { ensureDashboardWorker } from '../dashboard/ensure.js';
import { shouldPreferOsTerminal } from '../dashboard/spawn.js';
import { releaseDashboardSpawnLock, isDashboardSpawnPending } from '../dashboard/spawnLock.js';

/** CRBP v1 bootstrap response (cli终端显示.md). */
export interface BootstrapResponse {
  status: 'ok';
  runtime_id: string;
  mode: 'attached' | 'already_running';
  state: 'passive';
  source: AdapterKind;
  workspaceRoot: string;
  features: {
    file_watch: boolean;
    ast_diff: boolean;
    agent_stream: boolean;
  };
}

/**
 * Contorium Runtime Bootstrap — unified attach for IDE / MCP / CLI.
 * MCP initialize → this runs (not deferred to first file change).
 */
export async function bootstrapContoriumRuntime(
  workspaceRoot: string,
  source: AdapterKind,
  opts?: { reopenDashboard?: boolean },
): Promise<BootstrapResponse> {
  const root = path.resolve(workspaceRoot);
  await syncWorkspaceState(root, source);
  await bumpWorkspaceActivity(root, {
    source,
    kind: 'sync',
    detail: 'bootstrap',
  });

  if (opts?.reopenDashboard) {
    await stopDashboardWorker(root);
    await releaseDashboardSpawnLock(root);
    const workerSource = source === 'mcp' ? 'mcp' : 'cli';
    await ensureDashboardWorker(root, workerSource, { preferTerminal: shouldPreferOsTerminal() });
    const response: BootstrapResponse = {
      status: 'ok',
      runtime_id: `ctr-${Date.now().toString(36)}`,
      mode: 'attached',
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

  const alreadyRunning =
    (await isDashboardWorkerRunning(root)) || (await isDashboardSpawnPending(root));
  if (!alreadyRunning) {
    const workerSource = source === 'mcp' ? 'mcp' : 'cli';
    await ensureDashboardWorker(root, workerSource, { preferTerminal: shouldPreferOsTerminal() });
  }

  const response: BootstrapResponse = {
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
  await fs.writeFile(
    artifact,
    JSON.stringify({ ...response, at: Date.now() }, null, 2),
    'utf8',
  );

  return response;
}
