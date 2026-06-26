import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { moduleHistoryDir, moduleHistoryPath } from './paths.js';
import type { CognitiveEvent, ModuleHistoryRecord } from './types.js';
import { writeJsonFile } from '../intelligence/dimensions/io.js';

function moduleSlugFromPath(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return parts[0]!;
  }
  const base = parts[0] ?? norm;
  return base.replace(/\.[^.]+$/, '') || 'root';
}

function moduleMatches(event: CognitiveEvent, needle: string): boolean {
  const n = needle.toLowerCase();
  if (event.title.toLowerCase().includes(n) || event.summary.toLowerCase().includes(n)) {
    return true;
  }
  return event.files.some((f) => f.toLowerCase().includes(n));
}

/** Persist per-module event feeds under .contora/module-history/ */
export async function syncModuleHistory(
  workspaceRoot: string,
  events: CognitiveEvent[],
): Promise<Map<string, ModuleHistoryRecord>> {
  const byModule = new Map<string, CognitiveEvent[]>();

  for (const evt of events) {
    const modules = new Set<string>();
    for (const f of evt.files) {
      modules.add(moduleSlugFromPath(f));
    }
    if (evt.impact.length) {
      for (const imp of evt.impact) {
        modules.add(moduleSlugFromPath(imp));
      }
    }
    if (modules.size === 0 && evt.linked_intent) {
      modules.add(moduleSlugFromPath(evt.linked_intent));
    }
    for (const mod of modules) {
      const list = byModule.get(mod) ?? [];
      list.push(evt);
      byModule.set(mod, list);
    }
  }

  await fs.mkdir(moduleHistoryDir(workspaceRoot), { recursive: true });

  for (const [module, modEvents] of byModule) {
    const slug = module.replace(/[^\w.-]+/g, '_').slice(0, 64) || 'root';
    const record: ModuleHistoryRecord = {
      schema: 'module_history.v1',
      module,
      updated_at: new Date().toISOString(),
      projection_of: 'cognitive_events',
      events: modEvents
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 64)
        .map((e) => ({
          date: e.timestamp.slice(0, 10),
          title: e.title,
          why: e.why,
          event_id: e.id,
        })),
    };
    await writeJsonFile(moduleHistoryPath(workspaceRoot, slug), record);
  }

  return new Map(
    [...byModule.entries()].map(([mod, evts]) => [
      mod,
      {
        schema: 'module_history.v1' as const,
        module: mod,
        updated_at: new Date().toISOString(),
        projection_of: 'cognitive_events' as const,
        events: evts.slice(0, 64).map((e) => ({
          date: e.timestamp.slice(0, 10),
          title: e.title,
          why: e.why,
          event_id: e.id,
        })),
      },
    ]),
  );
}

export async function readModuleHistoryRecord(
  workspaceRoot: string,
  module: string,
): Promise<ModuleHistoryRecord | null> {
  const slug = module.replace(/[^\w.-]+/g, '_').slice(0, 64);
  try {
    const text = await fs.readFile(moduleHistoryPath(workspaceRoot, slug), 'utf8');
    const raw = JSON.parse(text) as ModuleHistoryRecord;
    if (raw?.schema === 'module_history.v1') {
      return raw;
    }
  } catch {
    /* fall through */
  }

  try {
    const dir = moduleHistoryDir(workspaceRoot);
    const files = await fs.readdir(dir);
    const needle = module.toLowerCase();
    for (const f of files) {
      if (!f.endsWith('.json')) {
        continue;
      }
      const text = await fs.readFile(path.join(dir, f), 'utf8');
      const raw = JSON.parse(text) as ModuleHistoryRecord;
      if (raw.module.toLowerCase().includes(needle)) {
        return raw;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function exploreModuleHistory(
  workspaceRoot: string,
  module: string,
  events?: CognitiveEvent[],
): Promise<{ module: string; formatted: string[]; record: ModuleHistoryRecord | null }> {
  let record = await readModuleHistoryRecord(workspaceRoot, module);
  if (!record && events) {
    const filtered = events.filter((e) => moduleMatches(e, module));
    record = {
      schema: 'module_history.v1',
      module,
      updated_at: new Date().toISOString(),
      projection_of: 'cognitive_events',
      events: filtered.map((e) => ({
        date: e.timestamp.slice(0, 10),
        title: e.title,
        why: e.why,
        event_id: e.id,
      })),
    };
  }

  const formatted: string[] = [`Module History: ${module}`, ''];
  if (!record?.events.length) {
    formatted.push('(no events for this module yet)');
    return { module, formatted, record };
  }

  for (const entry of record.events.slice(0, 24)) {
    formatted.push(entry.date, '', entry.title, '');
    if (entry.why) {
      formatted.push('WHY', entry.why, '');
    }
  }

  return { module, formatted, record };
}

export function filterEventsByModule(events: CognitiveEvent[], module: string): CognitiveEvent[] {
  return events.filter((e) => moduleMatches(e, module));
}
