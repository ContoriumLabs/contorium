import * as fs from 'node:fs/promises';
import { writeJsonFile, readJsonFile } from '../intelligence/dimensions/io.js';
import { knowledgeDir, knowledgeEntityPath, knowledgeIndexPath } from './paths.js';
import type {
  AdrRecord,
  CognitiveEvent,
  KnowledgeEntityIndex,
  KnowledgeEntityRecord,
  ProjectSnapshotRecord,
} from './types.js';
import { KNOWLEDGE_ENTITY_SCHEMA } from './types.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'was', 'were', 'has', 'have',
  'into', 'using', 'use', 'added', 'updated', 'changed', 'project', 'file', 'module',
]);

function normalizeEntity(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length < 2) {
    return null;
  }
  if (/^[A-Z]{2,}$/.test(t)) {
    return t.toUpperCase();
  }
  const lower = t.toLowerCase();
  if (STOP_WORDS.has(lower)) {
    return null;
  }
  return lower.replace(/[^\w.-]+/g, '_').slice(0, 48);
}

function slugForEntity(entity: string): string {
  return entity.toLowerCase().replace(/[^\w.-]+/g, '_');
}

function extractEntitiesFromText(text: string): string[] {
  const found = new Set<string>();
  const acronyms = text.match(/\b[A-Z]{2,}\b/g) ?? [];
  for (const a of acronyms) {
    const n = normalizeEntity(a);
    if (n) {
      found.add(n);
    }
  }
  for (const word of text.split(/[^\w.-]+/)) {
    const n = normalizeEntity(word);
    if (n && n.length >= 3) {
      found.add(n);
    }
  }
  return [...found];
}

function extractFromEvent(evt: CognitiveEvent): string[] {
  const parts = [evt.title, evt.summary, evt.decision, evt.why, ...evt.files, ...evt.impact].filter(
    Boolean,
  ) as string[];
  const entities = new Set<string>();
  for (const p of parts) {
    for (const e of extractEntitiesFromText(p)) {
      entities.add(e);
    }
    const base = p.split(/[/\\]/).pop();
    if (base) {
      const stem = base.replace(/\.[^.]+$/, '');
      const n = normalizeEntity(stem);
      if (n) {
        entities.add(n);
      }
    }
  }
  return [...entities];
}

function extractFromAdr(adr: AdrRecord): string[] {
  const parts = [adr.title, adr.reason, ...adr.alternatives, ...adr.related_events];
  const entities = new Set<string>();
  for (const p of parts) {
    for (const e of extractEntitiesFromText(p)) {
      entities.add(e);
    }
  }
  return [...entities];
}

/** Build entity → artifact links from CIL storage (projection, not SoT). */
export function buildKnowledgeGraph(
  events: CognitiveEvent[],
  adrs: AdrRecord[],
  snapshots: ProjectSnapshotRecord[],
): Map<string, KnowledgeEntityRecord> {
  const map = new Map<string, KnowledgeEntityRecord>();
  const now = new Date().toISOString();

  const ensure = (entity: string): KnowledgeEntityRecord => {
    let rec = map.get(entity);
    if (!rec) {
      rec = {
        schema: KNOWLEDGE_ENTITY_SCHEMA,
        entity,
        updated_at: now,
        projection_of: 'cognitive_events',
        derived_from: [],
        events: [],
        decisions: [],
        modules: [],
        snapshots: [],
      };
      map.set(entity, rec);
    }
    return rec;
  };

  for (const evt of events) {
    for (const entity of extractFromEvent(evt)) {
      const rec = ensure(entity);
      if (!rec.events.includes(evt.id)) {
        rec.events.push(evt.id);
      }
      for (const f of evt.files) {
        const mod = f.split(/[/\\]/).slice(-2).join('/');
        if (mod && !rec.modules.includes(mod)) {
          rec.modules.push(mod);
        }
      }
    }
  }

  for (const adr of adrs) {
    for (const entity of extractFromAdr(adr)) {
      const rec = ensure(entity);
      if (!rec.decisions.includes(adr.id)) {
        rec.decisions.push(adr.id);
      }
    }
  }

  for (const snap of snapshots) {
    const text = [snap.summary, snap.state.focus, snap.state.current_task].filter(Boolean).join(' ');
    for (const entity of extractEntitiesFromText(text)) {
      const rec = ensure(entity);
      if (!rec.snapshots.includes(snap.id)) {
        rec.snapshots.push(snap.id);
      }
    }
  }

  return map;
}

export async function syncKnowledgeGraph(
  workspaceRoot: string,
  events: CognitiveEvent[],
  adrs: AdrRecord[],
  snapshots: ProjectSnapshotRecord[],
): Promise<KnowledgeEntityIndex> {
  const graph = buildKnowledgeGraph(events, adrs, snapshots);
  await fs.mkdir(knowledgeDir(workspaceRoot), { recursive: true });

  for (const [entity, record] of graph) {
    record.derived_from = [...new Set([...record.events, ...record.decisions])];
    await writeJsonFile(knowledgeEntityPath(workspaceRoot, slugForEntity(entity)), record);
  }

  const index: KnowledgeEntityIndex = {
    schema: 'knowledge_index.v1',
    updated_at: new Date().toISOString(),
    projection_of: 'cognitive_events',
    entities: [...graph.keys()].sort(),
  };
  await writeJsonFile(knowledgeIndexPath(workspaceRoot), index);
  return index;
}

export async function readKnowledgeEntityIndex(workspaceRoot: string): Promise<KnowledgeEntityIndex | null> {
  return readJsonFile<KnowledgeEntityIndex>(knowledgeIndexPath(workspaceRoot));
}

export async function readKnowledgeEntity(
  workspaceRoot: string,
  entityQuery: string,
): Promise<KnowledgeEntityRecord | null> {
  const needle = entityQuery.trim().toLowerCase();
  const direct = await readJsonFile<KnowledgeEntityRecord>(
    knowledgeEntityPath(workspaceRoot, slugForEntity(needle)),
  );
  if (direct?.schema === KNOWLEDGE_ENTITY_SCHEMA) {
    return direct;
  }

  const index = await readKnowledgeEntityIndex(workspaceRoot);
  if (!index?.entities.length) {
    return null;
  }

  const match =
    index.entities.find((e) => e.toLowerCase() === needle) ??
    index.entities.find((e) => e.toLowerCase().includes(needle) || needle.includes(e.toLowerCase()));
  if (!match) {
    return null;
  }
  return readJsonFile<KnowledgeEntityRecord>(knowledgeEntityPath(workspaceRoot, slugForEntity(match)));
}

export async function exploreEntityKnowledge(
  workspaceRoot: string,
  entityQuery: string,
): Promise<{ entity: string; record: KnowledgeEntityRecord | null; formatted: string[] }> {
  const record = await readKnowledgeEntity(workspaceRoot, entityQuery);
  const entity = record?.entity ?? entityQuery;

  if (!record) {
    return {
      entity,
      record: null,
      formatted: [
        `Knowledge Graph: ${entityQuery}`,
        '',
        '(no entity links — run sync to build .contora/knowledge/)',
      ],
    };
  }

  const formatted: string[] = [
    `Everything related to: ${record.entity}`,
    '',
    `Events: ${record.events.length}`,
    ...record.events.slice(0, 12).map((id) => `  · ${id}`),
    '',
    `Decisions: ${record.decisions.length}`,
    ...record.decisions.slice(0, 12).map((id) => `  · ${id}`),
    '',
    `Modules: ${record.modules.length}`,
    ...record.modules.slice(0, 8).map((m) => `  · ${m}`),
    '',
    `Snapshots: ${record.snapshots.length}`,
    ...record.snapshots.slice(0, 6).map((id) => `  · ${id}`),
  ];

  return { entity: record.entity, record, formatted };
}
