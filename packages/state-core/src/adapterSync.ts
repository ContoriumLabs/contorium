import * as path from 'node:path';
import type { AdapterKind, StateEngineMode, StateSourceMetadata } from './types.js';
import { bootstrapStateFromScan, readStateJson, writeStateJson } from './bootstrap/bootstrapState.js';
import { rebuildArtifactsFromScan } from './state-builder/rebuildFromScan.js';
import { buildAndWriteUnderstandingArtifacts } from './understanding/buildUnderstanding.js';
import { buildDualModeInput } from './dualMode.js';
import { scanWorkspace } from './scanner/workspaceScanner.js';

async function countEventLines(workspaceRoot: string): Promise<number> {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(workspaceRoot, '.contora', 'events');
  let total = 0;
  try {
    const files = await readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.jsonl')) {
        continue;
      }
      const text = await readFile(join(dir, f), 'utf8');
      total += text.split('\n').filter((l) => l.trim()).length;
    }
  } catch {
    return 0;
  }
  return total;
}

export interface AdapterSyncResult {
  mode: StateEngineMode;
  /** true when .contora/state.json did not exist before this call */
  created: boolean;
  /** true when state.json or artifacts were written */
  updated: boolean;
  source?: StateSourceMetadata;
  eventCount: number;
}

/**
 * Shared one-shot sync for MCP / CLI adapters (runtime adapter pattern).
 * Scans workspace, merges into state.json, optionally rebuilds L4 when no events.
 */
export async function syncWorkspaceState(
  workspaceRoot: string,
  writer: AdapterKind,
  options?: { forceArtifacts?: boolean },
): Promise<AdapterSyncResult> {
  const resolved = path.resolve(workspaceRoot);
  const scan = await scanWorkspace(resolved);
  const eventCount = await countEventLines(resolved);
  const existing = await readStateJson(resolved);
  const created = !existing;

  if (!existing) {
    const state = bootstrapStateFromScan(scan);
    await writeStateJson(resolved, state, { mode: 'scan-driven', writer });
    await rebuildArtifactsFromScan(resolved, scan, state, writer);
    const written = await readStateJson(resolved);
    return {
      mode: 'scan-driven',
      created: true,
      updated: true,
      source: written?.source,
      eventCount,
    };
  }

  const dual = buildDualModeInput({ state: existing, eventCount, scan });
  const gitChanged =
    JSON.stringify(existing.gitStaged) !== JSON.stringify(dual.state.gitStaged) ||
    JSON.stringify(existing.gitWorking) !== JSON.stringify(dual.state.gitWorking);
  const recentChanged =
    eventCount === 0 &&
    JSON.stringify(existing.recentFiles) !== JSON.stringify(dual.state.recentFiles);
  const shouldWrite = gitChanged || recentChanged || options?.forceArtifacts;

  if (shouldWrite) {
    await writeStateJson(resolved, dual.state, { mode: dual.mode, writer });
  }

  if (eventCount === 0 && (shouldWrite || options?.forceArtifacts)) {
    await rebuildArtifactsFromScan(resolved, scan, dual.state, writer);
  }

  if (gitChanged || options?.forceArtifacts) {
    await buildAndWriteUnderstandingArtifacts({
      workspaceRoot: resolved,
      state: dual.state,
      scan,
    }).catch(() => undefined);
  }

  const written = await readStateJson(resolved);
  return {
    mode: dual.mode,
    created: false,
    updated: shouldWrite || (eventCount === 0 && !!options?.forceArtifacts),
    source: written?.source,
    eventCount,
  };
}

/** Read-only status for CLI `status` / IDE-less inspection. */
export async function readWorkspaceStatus(workspaceRoot: string): Promise<{
  workspaceRoot: string;
  hasState: boolean;
  mode: StateEngineMode | 'unknown';
  source?: StateSourceMetadata;
  eventCount: number;
  gitWorking: number;
  gitStaged: number;
  currentTask: string;
}> {
  const scan = await scanWorkspace(workspaceRoot);
  const state = await readStateJson(workspaceRoot);
  const eventCount = await countEventLines(workspaceRoot);
  const mode = state
    ? buildDualModeInput({ state, eventCount, scan }).mode
    : 'unknown';
  return {
    workspaceRoot,
    hasState: !!state,
    mode,
    source: state?.source,
    eventCount,
    gitWorking: state?.gitWorking.length ?? scan.gitWorking.length,
    gitStaged: state?.gitStaged.length ?? scan.gitStaged.length,
    currentTask: state?.currentTask ?? '',
  };
}
