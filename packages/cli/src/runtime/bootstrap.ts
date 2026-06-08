import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  bumpWorkspaceActivity,
  setGitSubprocessAllowed,
  syncWorkspaceState,
  type AdapterKind,
} from '@contora/state-core';
import { isDashboardWorkerRunning, stopDashboardWorker } from '../dashboard/daemon.js';
import { ensureDashboardWorker } from '../dashboard/ensure.js';
import type { DashboardSessionMarker } from '../dashboard/session.js';
import { shouldPreferOsTerminal } from '../dashboard/spawn.js';
import { releaseDashboardSpawnLock, isDashboardSpawnPending } from '../dashboard/spawnLock.js';

/** CRBP v1 bootstrap response. */
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

function dashboardSessionSource(source: AdapterKind): DashboardSessionMarker['source'] {
  if (source === 'mcp') {
    return 'mcp';
  }
  if (source === 'ide') {
    return 'ide';
  }
  return 'cli';
}

function newRuntimeId(): string {
  return `ctr-${Date.now().toString(36)}`;
}

async function readExistingRuntimeId(workspaceRoot: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(
      path.join(workspaceRoot, '.contora', 'runtime.bootstrap.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as { runtime_id?: string };
    return typeof parsed.runtime_id === 'string' && parsed.runtime_id.length > 0
      ? parsed.runtime_id
      : undefined;
  } catch {
    return undefined;
  }
}

async function writeBootstrapArtifact(
  workspaceRoot: string,
  response: BootstrapResponse,
): Promise<void> {
  const artifact = path.join(workspaceRoot, '.contora', 'runtime.bootstrap.json');
  await fs.mkdir(path.dirname(artifact), { recursive: true });
  await fs.writeFile(artifact, JSON.stringify({ ...response, at: Date.now() }, null, 2), 'utf8');
}

/**
 * Contorium Runtime Bootstrap — unified attach for IDE / MCP / CLI.
 * MCP initialize → this runs (not deferred to first file change).
 */
export async function bootstrapContoriumRuntime(
  workspaceRoot: string,
  source: AdapterKind,
  opts?: { reopenDashboard?: boolean; skipInitialSync?: boolean },
): Promise<BootstrapResponse> {
  const root = path.resolve(workspaceRoot);
  if (!opts?.skipInitialSync) {
    if (source !== 'mcp') {
      setGitSubprocessAllowed(true);
    }
    await syncWorkspaceState(root, source, { refreshGit: source !== 'mcp' });
  }
  await bumpWorkspaceActivity(root, {
    source,
    kind: 'sync',
    detail: 'bootstrap',
  });

  const workerSource = dashboardSessionSource(source);

  if (opts?.reopenDashboard) {
    await stopDashboardWorker(root);
    await releaseDashboardSpawnLock(root);
    await ensureDashboardWorker(root, workerSource, { preferTerminal: shouldPreferOsTerminal() });
    const response: BootstrapResponse = {
      status: 'ok',
      runtime_id: newRuntimeId(),
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
    await writeBootstrapArtifact(root, response);
    return response;
  }

  const alreadyRunning =
    (await isDashboardWorkerRunning(root)) || (await isDashboardSpawnPending(root));
  if (!alreadyRunning) {
    await ensureDashboardWorker(root, workerSource, { preferTerminal: shouldPreferOsTerminal() });
  }

  const runtime_id =
    alreadyRunning && !opts?.reopenDashboard
      ? ((await readExistingRuntimeId(root)) ?? newRuntimeId())
      : newRuntimeId();

  const response: BootstrapResponse = {
    status: 'ok',
    runtime_id,
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

  await writeBootstrapArtifact(root, response);
  return response;
}
