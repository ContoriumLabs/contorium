import * as path from 'node:path';
import { existsSync } from 'node:fs';
import type { AdapterKind, StateEngineMode, StateSourceMetadata } from './types.js';
import { bootstrapStateFromScan, readStateJson, writeStateJson } from './bootstrap/bootstrapState.js';
import { rebuildArtifactsFromScan } from './state-builder/rebuildFromScan.js';
import { buildAndWriteUnderstandingArtifacts } from './understanding/buildUnderstanding.js';
import { buildDualModeInput } from './dualMode.js';
import { bumpWorkspaceActivity } from './dashboardActivity.js';
import { scanWorkspace } from './scanner/workspaceScanner.js';
import { ensureGovernanceLayer } from './governance/init.js';
import { syncCognitiveLayer } from './governance/cognitiveProjection.js';

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

export interface AdapterSyncOptions {
  forceArtifacts?: boolean;
  /** Refresh git status from git.exe (default: use cached state.json git fields). */
  refreshGit?: boolean;
  /** @deprecated Prefer refreshGit — when true, skip git.exe subprocess. */
  skipGitScan?: boolean;
  /** Only `git status --porcelain` → state.json; no log/diff/understanding rebuild. */
  gitStatusOnly?: boolean;
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
  options?: AdapterSyncOptions,
): Promise<AdapterSyncResult> {
  const resolved = path.resolve(workspaceRoot);
  const existing = await readStateJson(resolved);
  const refreshGit = options?.refreshGit === true;
  const skipGitScan = options?.skipGitScan ?? !refreshGit;
  const skipGitTimeline = skipGitScan || options?.gitStatusOnly === true;
  const cachedGit = skipGitScan
    ? {
        staged: existing?.gitStaged ?? [],
        working: existing?.gitWorking ?? [],
        isRepo: existsSync(path.join(resolved, '.git')),
      }
    : undefined;
  const scan = await scanWorkspace(resolved, {
    skipGitScan,
    cachedGit,
  });
  const eventCount = await countEventLines(resolved);
  const created = !existing;

  await ensureGovernanceLayer(resolved).catch(() => undefined);

  if (!existing) {
    const state = bootstrapStateFromScan(scan);
    await writeStateJson(resolved, state, { mode: 'scan-driven', writer });
    await rebuildArtifactsFromScan(resolved, scan, state, writer, {
      skipGitTimeline,
    });
    const written = await readStateJson(resolved);
    await syncCognitiveLayer(resolved, written).catch(() => undefined);
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
    JSON.stringify(existing.recentFiles) !== JSON.stringify(dual.state.recentFiles);
  const shouldWrite = gitChanged || recentChanged || options?.forceArtifacts;

  if (shouldWrite) {
    await writeStateJson(resolved, dual.state, { mode: dual.mode, writer });
  }

  if (eventCount === 0 && (shouldWrite || options?.forceArtifacts)) {
    await rebuildArtifactsFromScan(resolved, scan, dual.state, writer, {
      skipGitTimeline,
    });
  }

  if (gitChanged || recentChanged || (options?.forceArtifacts && created)) {
    if (!options?.gitStatusOnly) {
      await buildAndWriteUnderstandingArtifacts({
        workspaceRoot: resolved,
        state: dual.state,
        scan,
        skipGitTimeline,
        allowGitDiff: refreshGit && !options?.gitStatusOnly,
      }).catch(() => undefined);
    }
  }

  const written = await readStateJson(resolved);
  const updated = shouldWrite || (eventCount === 0 && !!options?.forceArtifacts);

  // V3.2 — always refresh cognitive projection after sync (closed loop).
  await syncCognitiveLayer(resolved, written).catch(() => undefined);

  if (updated || gitChanged || recentChanged) {
    await bumpWorkspaceActivity(resolved, {
      source: writer,
      kind: gitChanged ? 'git_change' : recentChanged ? 'file_change' : 'sync',
      detail: gitChanged ? 'workspace sync' : recentChanged ? 'recent files updated' : undefined,
    }).catch(() => undefined);
  }
  return {
    mode: dual.mode,
    created: false,
    updated,
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
  const resolved = path.resolve(workspaceRoot);
  const state = await readStateJson(resolved);
  const scan = await scanWorkspace(resolved, {
    skipGitScan: true,
    cachedGit: state
      ? {
          staged: state.gitStaged ?? [],
          working: state.gitWorking ?? [],
          isRepo: existsSync(path.join(resolved, '.git')),
        }
      : {
          staged: [],
          working: [],
          isRepo: existsSync(path.join(resolved, '.git')),
        },
  });
  const eventCount = await countEventLines(workspaceRoot);
  const mode = state
    ? buildDualModeInput({ state, eventCount, scan }).mode
    : 'unknown';
  return {
    workspaceRoot: resolved,
    hasState: !!state,
    mode,
    source: state?.source,
    eventCount,
    gitWorking: state?.gitWorking.length ?? scan.gitWorking.length,
    gitStaged: state?.gitStaged.length ?? scan.gitStaged.length,
    currentTask: state?.currentTask ?? '',
  };
}
