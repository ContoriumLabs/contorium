import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readStateJson } from '@contora/state-core';
import { readWorkspaceActivity } from '@contora/state-core';
import { readDashboardSession } from './session.js';

const SESSION_IDLE_MS = 15 * 60 * 1000;
const SESSION_ACTIVE_MS = 10 * 60 * 1000;

async function latestEventTimestamp(workspaceRoot: string): Promise<number | undefined> {
  const eventsDir = path.join(workspaceRoot, '.contora', 'events');
  let latest = 0;
  try {
    const files = (await fs.readdir(eventsDir)).filter((f) => f.endsWith('.jsonl'));
    for (const file of files) {
      const text = await fs.readFile(path.join(eventsDir, file), 'utf8');
      const lines = text.split('\n').filter((l) => l.trim());
      const tail = lines[lines.length - 1];
      if (!tail) {
        continue;
      }
      try {
        const raw = JSON.parse(tail) as { timestamp?: number };
        const ts = Number(raw.timestamp ?? 0);
        if (ts > latest) {
          latest = ts;
        }
      } catch {
        // skip
      }
    }
  } catch {
    return undefined;
  }
  return latest || undefined;
}

export interface SessionProbe {
  active: boolean;
  reason: string;
}

/** Activity-driven session: recent file/function/git/event work (any adapter). */
export async function detectIdeSession(workspaceRoot: string): Promise<SessionProbe> {
  const activity = await readWorkspaceActivity(workspaceRoot);
  if (activity?.at && Date.now() - activity.at < SESSION_ACTIVE_MS) {
    return { active: true, reason: `activity:${activity.kind} (${activity.source})` };
  }

  const marker = await readDashboardSession(workspaceRoot);
  if (marker?.active) {
    const age = Date.now() - marker.startedAt;
    if (age < SESSION_IDLE_MS) {
      return { active: true, reason: `dashboard session (${marker.source})` };
    }
  }

  const state = await readStateJson(workspaceRoot);
  if (!state) {
    return { active: false, reason: 'no state.json' };
  }

  const now = Date.now();
  const lastEventTs = await latestEventTimestamp(workspaceRoot);
  const recentEvent = lastEventTs !== undefined && now - lastEventTs < SESSION_ACTIVE_MS;

  const lastUpdatedMs = state.source?.lastUpdated
    ? Date.parse(state.source.lastUpdated)
    : state.lastUpdated;
  const recentState =
    Number.isFinite(lastUpdatedMs) && now - lastUpdatedMs < SESSION_ACTIVE_MS;

  const ideWriter = state.source?.lastWriter === 'ide';
  const eventMode =
    state.source?.mode === 'event-driven' || state.source?.mode === 'merged';

  if (recentEvent) {
    return { active: true, reason: 'recent IDE events' };
  }
  if (ideWriter && (recentState || eventMode)) {
    return { active: true, reason: 'IDE adapter active' };
  }
  if (eventMode && recentState && (state.openFiles?.length ?? 0) > 0) {
    return { active: true, reason: 'merged mode with open files' };
  }

  if (lastEventTs !== undefined && now - lastEventTs < SESSION_IDLE_MS) {
    return { active: true, reason: 'session cooling' };
  }

  return { active: false, reason: 'no active IDE session' };
}
