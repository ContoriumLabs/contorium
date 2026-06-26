import * as fs from 'node:fs/promises';
import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readProjectIdentity } from '../intelligence/projectIdentity.js';
import { snapshotPath, snapshotsDir } from './paths.js';
import type { AdrRecord, CognitiveEvent, ProjectSnapshotRecord } from './types.js';
import { PROJECT_SNAPSHOT_SCHEMA } from './types.js';
import { readJsonFile, writeJsonFile } from '../intelligence/dimensions/io.js';

async function listSnapshotIds(workspaceRoot: string): Promise<string[]> {
  try {
    const files = await fs.readdir(snapshotsDir(workspaceRoot));
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

export function linkEventVersions(events: CognitiveEvent[]): CognitiveEvent[] {
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return sorted.map((evt, i) => ({
    ...evt,
    version: `snapshot_v${i + 1}`,
    previous: i > 0 ? sorted[i - 1]!.id : undefined,
    next: i < sorted.length - 1 ? sorted[i + 1]!.id : undefined,
  }));
}

export async function writeProjectSnapshot(
  workspaceRoot: string,
  events: CognitiveEvent[],
  decisions: AdrRecord[] = [],
): Promise<ProjectSnapshotRecord> {
  const existing = await listSnapshotIds(workspaceRoot);
  const versionNum = existing.length + 1;
  const id = `snapshot_v${versionNum}`;
  const [state, identity] = await Promise.all([
    readStateJson(workspaceRoot),
    readProjectIdentity(workspaceRoot),
  ]);

  const snapshot: ProjectSnapshotRecord = {
    schema: PROJECT_SNAPSHOT_SCHEMA,
    id,
    version: id,
    timestamp: new Date().toISOString(),
    state: {
      focus: state?.currentTask?.trim() || undefined,
      state_hash: identity?.current_state_hash,
      current_task: state?.currentTask?.trim() || undefined,
    },
    events: events.slice(-32),
    decisions: decisions.slice(-16),
    summary:
      state?.currentTask?.trim() ||
      events[events.length - 1]?.title ||
      'Project intelligence snapshot',
    projection_of: 'cognitive_events',
    derived_from: events.slice(-32).map((e) => e.id),
  };

  await writeJsonFile(snapshotPath(workspaceRoot, id), snapshot);

  return snapshot;
}

export async function readProjectSnapshot(
  workspaceRoot: string,
  snapshotId: string,
): Promise<ProjectSnapshotRecord | null> {
  const raw = await readJsonFile<ProjectSnapshotRecord>(snapshotPath(workspaceRoot, snapshotId));
  if (raw?.schema === PROJECT_SNAPSHOT_SCHEMA) {
    return raw;
  }
  const legacy = await readJsonFile<Record<string, unknown>>(snapshotPath(workspaceRoot, snapshotId));
  if (legacy && legacy.schema === 'project_snapshot.v1') {
    return {
      schema: PROJECT_SNAPSHOT_SCHEMA,
      id: String(legacy.id),
      version: String(legacy.version),
      timestamp: String(legacy.timestamp),
      state: {
        focus: legacy.focus as string | undefined,
        state_hash: legacy.state_hash as string | undefined,
      },
      events: [],
      decisions: [],
      summary: String(legacy.summary ?? ''),
      projection_of: 'cognitive_events',
      derived_from: [],
    };
  }
  return null;
}

export async function findSnapshotByDate(
  workspaceRoot: string,
  dateStr: string,
): Promise<ProjectSnapshotRecord | null> {
  let best: ProjectSnapshotRecord | null = null;
  let bestDelta = Infinity;
  const target = Date.parse(dateStr);
  if (!Number.isFinite(target)) {
    return null;
  }

  for (const id of await listSnapshotIds(workspaceRoot)) {
    const snap = await readProjectSnapshot(workspaceRoot, id);
    if (!snap) {
      continue;
    }
    const delta = Math.abs(Date.parse(snap.timestamp.slice(0, 10)) - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = snap;
    }
  }
  return best;
}

export async function listProjectSnapshots(
  workspaceRoot: string,
): Promise<ProjectSnapshotRecord[]> {
  const ids = await listSnapshotIds(workspaceRoot);
  const snaps: ProjectSnapshotRecord[] = [];
  for (const id of ids) {
    const s = await readProjectSnapshot(workspaceRoot, id);
    if (s) {
      snaps.push(s);
    }
  }
  return snaps.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
