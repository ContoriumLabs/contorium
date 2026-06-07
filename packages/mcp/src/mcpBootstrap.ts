import * as fs from 'node:fs';
import * as path from 'node:path';
import { syncWorkspaceState } from '@contora/state-core';
import { scheduleMcpDashboardWake, scheduleMcpRuntimeBootstrap } from './dashboardEnsure.js';
import {
  checkActiveRuntime,
  confirmHandoffInjection,
  readHandoffInjectionState,
  syncInjectionWithRuntime,
} from '@contora/state-core';

const CONTORA_EVENTS = '.contora/events';
const SYNC_MS = 5_000;
const DEBOUNCE_MS = 400;

let syncTimer: ReturnType<typeof setInterval> | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let eventsWatcher: fs.FSWatcher | undefined;
let gitHeadWatcher: fs.FSWatcher | undefined;

function scheduleReactiveSync(workspaceRoot: string): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    void syncWorkspaceState(workspaceRoot, 'mcp')
      .then(async () => {
        scheduleMcpDashboardWake(workspaceRoot, 'mcp-reactive-sync');
        await syncInjectionWithRuntime(workspaceRoot);
        const { runtime_id } = await checkActiveRuntime(workspaceRoot);
        const injection = await readHandoffInjectionState(workspaceRoot);
        if (
          runtime_id &&
          injection?.runtime_id === runtime_id &&
          injection.status === 'injected'
        ) {
          await confirmHandoffInjection(workspaceRoot, injection.format ?? 'markdown');
        }
      })
      .catch(() => undefined);
  }, DEBOUNCE_MS);
}

/** MCP startup bootstrap. */
export async function ensureWorkspaceBootstrapped(workspaceRoot: string): Promise<{
  bootstrapped: boolean;
  mode: string;
}> {
  const result = await syncWorkspaceState(workspaceRoot, 'mcp', { forceArtifacts: true });
  if (result.created) {
    console.error('[contorium-mcp] bootstrap: created .contora/state.json (scan-driven)');
  }
  return { bootstrapped: result.created, mode: result.mode };
}

/** Light sync: 5s poll + watch events dir and git HEAD. */
export function startMcpLightSync(workspaceRoot: string): void {
  stopMcpLightSync();
  const root = path.resolve(workspaceRoot);
  syncTimer = setInterval(() => {
    void syncWorkspaceState(root, 'mcp').catch(() => undefined);
  }, SYNC_MS);
  syncTimer.unref?.();

  const eventsDir = path.join(root, CONTORA_EVENTS);
  try {
    fs.mkdirSync(eventsDir, { recursive: true });
    eventsWatcher = fs.watch(eventsDir, () => scheduleReactiveSync(root));
    eventsWatcher.unref?.();
  } catch {
    /* optional */
  }

  const gitHead = path.join(root, '.git', 'HEAD');
  try {
    gitHeadWatcher = fs.watch(gitHead, () => scheduleReactiveSync(root));
    gitHeadWatcher.unref?.();
  } catch {
    /* not a git repo */
  }
}

export function stopMcpLightSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  eventsWatcher?.close();
  eventsWatcher = undefined;
  gitHeadWatcher?.close();
  gitHeadWatcher = undefined;
}
