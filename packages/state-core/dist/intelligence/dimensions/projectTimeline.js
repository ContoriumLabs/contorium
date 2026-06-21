"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProjectEvolutionTimeline = readProjectEvolutionTimeline;
exports.queryProjectEvolutionTimeline = queryProjectEvolutionTimeline;
exports.appendProjectEvolutionEvents = appendProjectEvolutionEvents;
exports.makeEvolutionEvent = makeEvolutionEvent;
const paths_js_1 = require("../paths.js");
const types_js_1 = require("../types.js");
const io_js_1 = require("./io.js");
function triggerSource(writer) {
    if (writer === 'ide') {
        return 'IDE';
    }
    if (writer === 'mcp') {
        return 'MCP';
    }
    return 'CLI';
}
async function readProjectEvolutionTimeline(workspaceRoot) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.projectEvolutionTimelinePath)(workspaceRoot));
    if (raw?.schema === types_js_1.PROJECT_EVOLUTION_SCHEMA && Array.isArray(raw.events)) {
        return raw;
    }
    return null;
}
function queryProjectEvolutionTimeline(timeline, query) {
    let events = [...timeline.events];
    if (query?.from !== undefined) {
        events = events.filter((e) => e.timestamp >= query.from);
    }
    if (query?.to !== undefined) {
        events = events.filter((e) => e.timestamp <= query.to);
    }
    if (query?.type) {
        events = events.filter((e) => e.event_type === query.type);
    }
    if (query?.intent) {
        const needle = query.intent.toLowerCase();
        events = events.filter((e) => e.linked_intent?.toLowerCase().includes(needle) ||
            e.entity_id.toLowerCase().includes(needle));
    }
    return events.sort((a, b) => b.timestamp - a.timestamp);
}
async function appendProjectEvolutionEvents(workspaceRoot, events) {
    const existing = (await readProjectEvolutionTimeline(workspaceRoot)) ?? {
        schema: types_js_1.PROJECT_EVOLUTION_SCHEMA,
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
    const timeline = {
        schema: types_js_1.PROJECT_EVOLUTION_SCHEMA,
        updated_at: new Date().toISOString(),
        events: merged.slice(-256),
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.projectEvolutionTimelinePath)(workspaceRoot), timeline);
    return timeline;
}
function makeEvolutionEvent(input) {
    const ts = input.timestamp ?? Date.now();
    const source = input.trigger_source === 'Git' ||
        input.trigger_source === 'IDE' ||
        input.trigger_source === 'MCP' ||
        input.trigger_source === 'CLI'
        ? input.trigger_source
        : triggerSource(input.trigger_source);
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
