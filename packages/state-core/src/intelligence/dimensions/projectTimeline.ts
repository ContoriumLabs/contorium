import type { AdapterKind } from '../../types.js';
import { projectEvolutionTimelinePath } from '../paths.js';
import type {
  EvolutionEventType,
  ProjectEvolutionEvent,
  ProjectEvolutionTimeline,
} from '../types.js';
import { PROJECT_EVOLUTION_SCHEMA } from '../types.js';
import { readJsonFile, writeJsonFile } from './io.js';

export interface ProjectTimelineQuery {
  from?: number;
  to?: number;
  type?: EvolutionEventType;
  intent?: string;
}

function triggerSource(writer: AdapterKind): ProjectEvolutionEvent['trigger_source'] {
  if (writer === 'ide') {
    return 'IDE';
  }
  if (writer === 'mcp') {
    return 'MCP';
  }
  return 'CLI';
}

export async function readProjectEvolutionTimeline(
  workspaceRoot: string,
): Promise<ProjectEvolutionTimeline | null> {
  const raw = await readJsonFile<ProjectEvolutionTimeline>(projectEvolutionTimelinePath(workspaceRoot));
  if (raw?.schema === PROJECT_EVOLUTION_SCHEMA && Array.isArray(raw.events)) {
    return raw;
  }
  return null;
}

export function queryProjectEvolutionTimeline(
  timeline: ProjectEvolutionTimeline,
  query?: ProjectTimelineQuery,
): ProjectEvolutionEvent[] {
  let events = [...timeline.events];
  if (query?.from !== undefined) {
    events = events.filter((e) => e.timestamp >= query.from!);
  }
  if (query?.to !== undefined) {
    events = events.filter((e) => e.timestamp <= query.to!);
  }
  if (query?.type) {
    events = events.filter((e) => e.event_type === query.type);
  }
  if (query?.intent) {
    const needle = query.intent.toLowerCase();
    events = events.filter(
      (e) =>
        e.linked_intent?.toLowerCase().includes(needle) ||
        e.entity_id.toLowerCase().includes(needle),
    );
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

export async function appendProjectEvolutionEvents(
  workspaceRoot: string,
  events: ProjectEvolutionEvent[],
): Promise<ProjectEvolutionTimeline> {
  const existing = (await readProjectEvolutionTimeline(workspaceRoot)) ?? {
    schema: PROJECT_EVOLUTION_SCHEMA,
    updated_at: new Date().toISOString(),
    events: [],
  };

  const seen = new Set(existing.events.map((e) => e.event_id));
  const merged = [...existing.events];
  for (const evt of events) {
    if (seen.has(evt.event_id)) {
      continue;
    }
    seen.add(evt.event_id);
    merged.push(evt);
  }

  const timeline: ProjectEvolutionTimeline = {
    schema: PROJECT_EVOLUTION_SCHEMA,
    updated_at: new Date().toISOString(),
    events: merged.slice(-256),
  };

  await writeJsonFile(projectEvolutionTimelinePath(workspaceRoot), timeline);
  return timeline;
}

export function makeEvolutionEvent(input: {
  event_type: EvolutionEventType;
  entity_id: string;
  before_snapshot?: Record<string, unknown>;
  after_snapshot?: Record<string, unknown>;
  trigger_source: AdapterKind | ProjectEvolutionEvent['trigger_source'];
  linked_intent?: string;
  linked_decision?: string;
  impact_summary?: string;
  timestamp?: number;
}): ProjectEvolutionEvent {
  const ts = input.timestamp ?? Date.now();
  const source: ProjectEvolutionEvent['trigger_source'] =
    input.trigger_source === 'Git' ||
    input.trigger_source === 'IDE' ||
    input.trigger_source === 'MCP' ||
    input.trigger_source === 'CLI'
      ? input.trigger_source
      : triggerSource(input.trigger_source as AdapterKind);

  return {
    event_id: `evt_${input.entity_id}_${ts}`,
    timestamp: ts,
    event_type: input.event_type,
    entity_id: input.entity_id,
    before_snapshot: input.before_snapshot ?? {},
    after_snapshot: input.after_snapshot ?? {},
    before: input.before_snapshot ?? {},
    after: input.after_snapshot ?? {},
    trigger_source: source,
    source,
    linked_intent: input.linked_intent,
    linked_decision: input.linked_decision,
    impact_summary: input.impact_summary,
  };
}
