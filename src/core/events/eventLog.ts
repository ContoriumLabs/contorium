import * as fs from 'fs/promises';
import { open } from 'node:fs/promises';
import * as path from 'path';
import { CONTORA_DATA_DIR, CONTORA_LEGACY_DATA_DIR } from '../../constants';
import type { WorkspaceEvent } from '../models/events';
import { parseEventLine, serializeEventLine } from './eventSerializer';

const EVENTS_DIR = 'events';
/** When JSONL exceeds this size, only the tail is read on startup replay (faster activate). */
const REPLAY_TAIL_MAX_BYTES = 512 * 1024;

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function safeSessionFileName(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'session';
}

export function eventLogPathForSession(workspaceRootFsPath: string, sessionId: string): string {
  const safe = safeSessionFileName(sessionId);
  return path.join(workspaceRootFsPath, CONTORA_DATA_DIR, EVENTS_DIR, `${safe}.jsonl`);
}

function parseEventsFromRaw(raw: string): WorkspaceEvent[] {
  const out: WorkspaceEvent[] = [];
  for (const line of raw.split('\n')) {
    const ev = parseEventLine(line);
    if (ev) {
      out.push(ev);
    }
  }
  return out;
}

async function readUtf8Tail(filePath: string, maxBytes: number): Promise<string | undefined> {
  let handle;
  try {
    handle = await open(filePath, 'r');
    const stat = await handle.stat();
    const size = stat.size;
    if (size === 0) {
      return '';
    }
    const readLen = Math.min(size, maxBytes);
    const buf = Buffer.alloc(readLen);
    await handle.read(buf, 0, readLen, size - readLen);
    let text = buf.toString('utf8');
    if (readLen < size) {
      const nl = text.indexOf('\n');
      if (nl >= 0) {
        text = text.slice(nl + 1);
      }
    }
    return text;
  } catch {
    return undefined;
  } finally {
    await handle?.close();
  }
}

async function readSessionEventsFromFile(filePath: string, maxEvents: number): Promise<WorkspaceEvent[]> {
  try {
    const stat = await fs.stat(filePath);
    const raw =
      stat.size > REPLAY_TAIL_MAX_BYTES
        ? await readUtf8Tail(filePath, REPLAY_TAIL_MAX_BYTES)
        : await fs.readFile(filePath, 'utf8');
    if (raw === undefined) {
      return [];
    }
    const parsed = parseEventsFromRaw(raw);
    if (maxEvents > 0 && parsed.length > maxEvents) {
      return parsed.slice(-maxEvents);
    }
    return parsed;
  } catch {
    return [];
  }
}

export async function appendEventJsonl(
  workspaceRootFsPath: string,
  sessionId: string,
  event: WorkspaceEvent,
): Promise<void> {
  const dir = path.join(workspaceRootFsPath, CONTORA_DATA_DIR, EVENTS_DIR);
  await ensureDir(dir);
  const file = path.join(dir, `${safeSessionFileName(sessionId)}.jsonl`);
  await fs.appendFile(file, serializeEventLine(event), 'utf8');
}

/**
 * Event log API: read session, tail stream, replay from JSONL on disk (Contorium; legacy path fallback).
 */
export class EventLog {
  static async readSessionEvents(
    workspaceRootFsPath: string,
    sessionId: string,
    maxEvents = 0,
  ): Promise<WorkspaceEvent[]> {
    const safe = safeSessionFileName(sessionId);
    const primary = path.join(workspaceRootFsPath, CONTORA_DATA_DIR, EVENTS_DIR, `${safe}.jsonl`);
    const fromPrimary = await readSessionEventsFromFile(primary, maxEvents);
    if (fromPrimary.length > 0) {
      return fromPrimary;
    }
    const legacy = path.join(workspaceRootFsPath, CONTORA_LEGACY_DATA_DIR, EVENTS_DIR, `${safe}.jsonl`);
    return readSessionEventsFromFile(legacy, maxEvents);
  }

  static async streamRecent(
    workspaceRootFsPath: string,
    sessionId: string,
    limit: number,
  ): Promise<WorkspaceEvent[]> {
    if (limit <= 0) {
      return [];
    }
    return EventLog.readSessionEvents(workspaceRootFsPath, sessionId, limit);
  }

  /** Startup replay — capped to in-memory buffer size. */
  static replayRecent(
    workspaceRootFsPath: string,
    sessionId: string,
    limit: number,
  ): Promise<WorkspaceEvent[]> {
    return EventLog.streamRecent(workspaceRootFsPath, sessionId, limit);
  }

  static replay(workspaceRootFsPath: string, sessionId: string): Promise<WorkspaceEvent[]> {
    return EventLog.readSessionEvents(workspaceRootFsPath, sessionId);
  }
}
