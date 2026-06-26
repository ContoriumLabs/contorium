import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readDecisionLog } from '../intelligence/systems/decisionLog.js';
import { readDecisionProvenanceGraph } from '../intelligence/decisionProvenance.js';
import { readProjectEvolutionTimeline } from '../intelligence/dimensions/projectTimeline.js';
import { readChangeArtifact } from '../understanding/store.js';
import type { AdapterKind } from '../types.js';
import { freshnessFromAge } from './confidenceLabels.js';
import {
  readAllCognitiveEvents,
  writeAdrRecord,
  writeCognitiveEvent,
} from './eventStore.js';
import type { AdrRecord, CognitiveEvent, CognitiveEventSource } from './types.js';
import { ADR_RECORD_SCHEMA, COGNITIVE_EVENT_SCHEMA } from './types.js';
import { riskFromReversibility } from './confidenceLabels.js';
import { linkEventVersions } from './snapshotEngine.js';
import { applyImplementedStatus } from './decisionLifecycle.js';

function sourceFromWriter(writer: AdapterKind): CognitiveEventSource {
  if (writer === 'ide') {
    return 'ide';
  }
  if (writer === 'mcp') {
    return 'mcp';
  }
  return 'cli';
}

function eventIdFromTimestamp(ts: string, suffix: string): string {
  const d = ts.slice(0, 10);
  const slug = suffix.replace(/[^\w]+/g, '_').slice(0, 24) || 'evt';
  return `${d}_evt_${slug}`;
}

function mapWriterSources(writer: AdapterKind): CognitiveEventSource[] {
  const s = sourceFromWriter(writer);
  return [s, 'git'];
}

/** Build unified cognitive events from existing PIL artifacts. */
export async function syncCognitiveEvents(
  workspaceRoot: string,
  writer: AdapterKind = 'cli',
): Promise<CognitiveEvent[]> {
  const [timeline, decisionGraph, decisionLog, change, state] = await Promise.all([
    readProjectEvolutionTimeline(workspaceRoot),
    readDecisionProvenanceGraph(workspaceRoot),
    readDecisionLog(workspaceRoot),
    readChangeArtifact(workspaceRoot),
    readStateJson(workspaceRoot),
  ]);

  const events: CognitiveEvent[] = [];
  const seen = new Set<string>();

  for (const evt of timeline?.events ?? []) {
    const ts = new Date(evt.timestamp * 1000).toISOString();
    const id = eventIdFromTimestamp(ts, evt.event_id || evt.entity_id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    events.push({
      schema: COGNITIVE_EVENT_SCHEMA,
      id,
      timestamp: ts,
      title: evt.impact_summary || `${evt.event_type}: ${evt.entity_id}`,
      summary: evt.impact_summary || evt.event_type,
      files: [],
      impact: evt.linked_intent ? [evt.linked_intent] : [],
      linked_intent: evt.linked_intent,
      freshness: freshnessFromAge(ts),
      source: [evt.trigger_source?.toLowerCase() as CognitiveEventSource].filter(Boolean),
      provenance: [evt.trigger_source ?? 'sync'],
    });
  }

  for (const node of decisionGraph?.nodes ?? []) {
    const ts = node.timestamp || new Date().toISOString();
    const id = eventIdFromTimestamp(ts, node.decision_id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    events.push({
      schema: COGNITIVE_EVENT_SCHEMA,
      id,
      timestamp: ts,
      title: node.title,
      summary: node.selected,
      files: node.impact_scope ?? [],
      decision: node.selected,
      why: node.reason,
      impact: node.impact_scope ?? [],
      linked_decision_id: node.decision_id,
      linked_intent: node.linked_intent,
      freshness: freshnessFromAge(ts),
      source: mapWriterSources(writer),
      provenance: ['governance', 'decision'],
    });
  }

  for (const entry of decisionLog?.entries ?? []) {
    const ts = entry.created_at;
    const id = eventIdFromTimestamp(ts, entry.decision_id);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    events.push({
      schema: COGNITIVE_EVENT_SCHEMA,
      id,
      timestamp: ts,
      title: entry.selected,
      summary: entry.reason,
      files: entry.impact,
      decision: entry.selected,
      why: entry.reason,
      impact: entry.impact,
      linked_decision_id: entry.decision_id,
      linked_intent: entry.intent_id,
      freshness: freshnessFromAge(ts),
      source: ['manual', sourceFromWriter(writer)],
      provenance: ['capture_decision'],
    });
  }

  if (change?.changed_files?.length) {
    const ts = new Date(change.generatedAt || Date.now()).toISOString();
    const id = eventIdFromTimestamp(ts, 'workspace_change');
    if (!seen.has(id)) {
      seen.add(id);
      events.push({
        schema: COGNITIVE_EVENT_SCHEMA,
        id,
        timestamp: ts,
        title: `Modified ${change.changed_files.length} file(s)`,
        summary: `${change.key_changes?.length ?? 0} key symbol change(s)`,
        files: change.changed_files.slice(0, 32),
        impact: change.changed_files.slice(0, 8),
        freshness: 'fresh',
        source: mapWriterSources(writer),
        provenance: ['git', 'scan'],
      });
    }
  }

  const focus = state?.currentTask?.trim();
  if (focus) {
    const ts = state?.lastUpdated
      ? new Date(state.lastUpdated).toISOString()
      : new Date().toISOString();
    const id = eventIdFromTimestamp(ts, 'current_focus');
    if (!seen.has(id)) {
      seen.add(id);
      events.push({
        schema: COGNITIVE_EVENT_SCHEMA,
        id,
        timestamp: ts,
        title: focus,
        summary: 'Current project focus',
        files: [],
        impact: [],
        freshness: freshnessFromAge(ts),
        source: [sourceFromWriter(writer), 'manual'],
        provenance: ['focus_note'],
      });
    }
  }

  const linked = linkEventVersions(events);
  for (const evt of linked) {
    await writeCognitiveEvent(workspaceRoot, evt);
  }

  return linked.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^\w]+/)
      .filter((t) => t.length > 3),
  );
}

function applyAdrLifecycle(records: AdrRecord[]): AdrRecord[] {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (cur.status === 'rejected' || cur.status === 'deprecated') {
      continue;
    }
    for (let j = i + 1; j < sorted.length; j++) {
      const newer = sorted[j]!;
      const overlap = [...titleTokens(cur.title)].filter((t) => titleTokens(newer.title).has(t));
      if (overlap.length >= 1 && newer.date >= cur.date) {
        cur.status = 'superseded';
        cur.superseded_by = newer.id;
        break;
      }
    }
  }
  return sorted;
}

/** Generate ADR records from decision provenance nodes. */
export async function syncDecisionCenter(workspaceRoot: string): Promise<AdrRecord[]> {
  const graph = await readDecisionProvenanceGraph(workspaceRoot);
  const events = await readAllCognitiveEvents(workspaceRoot);
  const records: AdrRecord[] = [];
  let seq = 1;

  for (const node of graph?.nodes ?? []) {
    const id = `ADR-${String(seq).padStart(3, '0')}`;
    seq += 1;
    const related = events
      .filter((e) => e.linked_decision_id === node.decision_id)
      .map((e) => e.id);
    const record: AdrRecord = {
      schema: ADR_RECORD_SCHEMA,
      id,
      title: node.title,
      status: 'accepted',
      date: (node.timestamp || new Date().toISOString()).slice(0, 10),
      reason: node.reason,
      alternatives: node.alternatives?.length ? node.alternatives : ['no change', 'defer'],
      risk: riskFromReversibility(node.reversibility),
      related_events: related,
      edges: related,
      freshness: freshnessFromAge(node.timestamp),
      last_verified: node.timestamp,
    };
    await writeAdrRecord(workspaceRoot, record);
    records.push(record);
  }

  const log = await readDecisionLog(workspaceRoot);
  for (const entry of log?.entries ?? []) {
    const id = `ADR-${String(seq).padStart(3, '0')}`;
    seq += 1;
    const related = events
      .filter((e) => e.linked_decision_id === entry.decision_id)
      .map((e) => e.id);
    const record: AdrRecord = {
      schema: ADR_RECORD_SCHEMA,
      id,
      title: entry.selected,
      status: 'accepted',
      date: entry.created_at.slice(0, 10),
      reason: entry.reason,
      alternatives: ['alternative not recorded'],
      risk: 'medium',
      related_events: related,
      edges: related,
      freshness: freshnessFromAge(entry.created_at),
      last_verified: entry.created_at,
    };
    await writeAdrRecord(workspaceRoot, record);
    records.push(record);
  }

  const withLifecycle = applyImplementedStatus(applyAdrLifecycle(records));
  for (const adr of withLifecycle) {
    await writeAdrRecord(workspaceRoot, adr);
  }

  return withLifecycle;
}
