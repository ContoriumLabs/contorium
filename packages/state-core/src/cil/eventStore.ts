import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  adrDir,
  adrPath,
  cilIndexPath,
  cognitiveEventPath,
  cognitiveEventsDir,
} from './paths.js';
import type { AdrRecord, CognitiveEvent, CognitiveEventIndex } from './types.js';
import { ADR_RECORD_SCHEMA, CIL_INDEX_SCHEMA, COGNITIVE_EVENT_SCHEMA } from './types.js';

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function readCognitiveEventIndex(
  workspaceRoot: string,
): Promise<CognitiveEventIndex | null> {
  const raw = await readJson<CognitiveEventIndex>(cilIndexPath(workspaceRoot));
  if (raw?.schema === CIL_INDEX_SCHEMA) {
    return raw;
  }
  return null;
}

export async function readCognitiveEvent(
  workspaceRoot: string,
  eventId: string,
): Promise<CognitiveEvent | null> {
  const raw = await readJson<CognitiveEvent>(cognitiveEventPath(workspaceRoot, eventId));
  if (raw?.schema === COGNITIVE_EVENT_SCHEMA && raw.id === eventId) {
    return raw;
  }
  return null;
}

export async function writeCognitiveEvent(
  workspaceRoot: string,
  event: CognitiveEvent,
): Promise<void> {
  await writeJson(cognitiveEventPath(workspaceRoot, event.id), event);
}

export async function readAllCognitiveEvents(workspaceRoot: string): Promise<CognitiveEvent[]> {
  const index = await readCognitiveEventIndex(workspaceRoot);
  if (index?.event_ids.length) {
    const events: CognitiveEvent[] = [];
    for (const id of index.event_ids) {
      const evt = await readCognitiveEvent(workspaceRoot, id);
      if (evt) {
        events.push(evt);
      }
    }
    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  const dir = cognitiveEventsDir(workspaceRoot);
  try {
    const files = await fs.readdir(dir);
    const events: CognitiveEvent[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) {
        continue;
      }
      const raw = await readJson<CognitiveEvent>(path.join(dir, f));
      if (raw?.schema === COGNITIVE_EVENT_SCHEMA) {
        events.push(raw);
      }
    }
    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}

export async function readAdrRecord(workspaceRoot: string, adrId: string): Promise<AdrRecord | null> {
  const raw = await readJson<
    Partial<AdrRecord> & { schema?: string; id?: string; related_events?: string[] }
  >(adrPath(workspaceRoot, adrId));
  if (!raw?.id || raw.id !== adrId) {
    return null;
  }
  if (raw.schema === ADR_RECORD_SCHEMA) {
    return raw as AdrRecord;
  }
  if (raw.schema === 'adr.v1') {
    return { ...raw, schema: ADR_RECORD_SCHEMA, edges: raw.related_events ?? [] } as AdrRecord;
  }
  return null;
}

export async function writeAdrRecord(workspaceRoot: string, adr: AdrRecord): Promise<void> {
  await writeJson(adrPath(workspaceRoot, adr.id), adr);
}

export async function readAllAdrRecords(workspaceRoot: string): Promise<AdrRecord[]> {
  const index = await readCognitiveEventIndex(workspaceRoot);
  if (index?.adr_ids.length) {
    const records: AdrRecord[] = [];
    for (const id of index.adr_ids) {
      const adr = await readAdrRecord(workspaceRoot, id);
      if (adr) {
        records.push(adr);
      }
    }
    return records.sort((a, b) => b.date.localeCompare(a.date));
  }

  try {
    const files = await fs.readdir(adrDir(workspaceRoot));
    const records: AdrRecord[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) {
        continue;
      }
      const raw = await readJson<AdrRecord>(path.join(adrDir(workspaceRoot), f));
      if (raw?.schema === ADR_RECORD_SCHEMA) {
        records.push(raw);
      }
    }
    return records.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function persistCilIndex(
  workspaceRoot: string,
  eventIds: string[],
  adrIds: string[],
  projections?: CognitiveEventIndex['projections'],
): Promise<CognitiveEventIndex> {
  const index: CognitiveEventIndex = {
    schema: CIL_INDEX_SCHEMA,
    updated_at: new Date().toISOString(),
    event_ids: [...new Set(eventIds)],
    adr_ids: [...new Set(adrIds)],
    ...(projections ? { projections } : {}),
  };
  await writeJson(cilIndexPath(workspaceRoot), index);
  return index;
}
