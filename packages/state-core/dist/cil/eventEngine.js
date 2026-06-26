"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCognitiveEvents = syncCognitiveEvents;
exports.syncDecisionCenter = syncDecisionCenter;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const decisionLog_js_1 = require("../intelligence/systems/decisionLog.js");
const decisionProvenance_js_1 = require("../intelligence/decisionProvenance.js");
const projectTimeline_js_1 = require("../intelligence/dimensions/projectTimeline.js");
const store_js_1 = require("../understanding/store.js");
const confidenceLabels_js_1 = require("./confidenceLabels.js");
const eventStore_js_1 = require("./eventStore.js");
const types_js_1 = require("./types.js");
const confidenceLabels_js_2 = require("./confidenceLabels.js");
const snapshotEngine_js_1 = require("./snapshotEngine.js");
const decisionLifecycle_js_1 = require("./decisionLifecycle.js");
function sourceFromWriter(writer) {
    if (writer === 'ide') {
        return 'ide';
    }
    if (writer === 'mcp') {
        return 'mcp';
    }
    return 'cli';
}
function eventIdFromTimestamp(ts, suffix) {
    const d = ts.slice(0, 10);
    const slug = suffix.replace(/[^\w]+/g, '_').slice(0, 24) || 'evt';
    return `${d}_evt_${slug}`;
}
function mapWriterSources(writer) {
    const s = sourceFromWriter(writer);
    return [s, 'git'];
}
/** Build unified cognitive events from existing PIL artifacts. */
async function syncCognitiveEvents(workspaceRoot, writer = 'cli') {
    const [timeline, decisionGraph, decisionLog, change, state] = await Promise.all([
        (0, projectTimeline_js_1.readProjectEvolutionTimeline)(workspaceRoot),
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot),
        (0, decisionLog_js_1.readDecisionLog)(workspaceRoot),
        (0, store_js_1.readChangeArtifact)(workspaceRoot),
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
    ]);
    const events = [];
    const seen = new Set();
    for (const evt of timeline?.events ?? []) {
        const ts = new Date(evt.timestamp * 1000).toISOString();
        const id = eventIdFromTimestamp(ts, evt.event_id || evt.entity_id);
        if (seen.has(id)) {
            continue;
        }
        seen.add(id);
        events.push({
            schema: types_js_1.COGNITIVE_EVENT_SCHEMA,
            id,
            timestamp: ts,
            title: evt.impact_summary || `${evt.event_type}: ${evt.entity_id}`,
            summary: evt.impact_summary || evt.event_type,
            files: [],
            impact: evt.linked_intent ? [evt.linked_intent] : [],
            linked_intent: evt.linked_intent,
            freshness: (0, confidenceLabels_js_1.freshnessFromAge)(ts),
            source: [evt.trigger_source?.toLowerCase()].filter(Boolean),
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
            schema: types_js_1.COGNITIVE_EVENT_SCHEMA,
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
            freshness: (0, confidenceLabels_js_1.freshnessFromAge)(ts),
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
            schema: types_js_1.COGNITIVE_EVENT_SCHEMA,
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
            freshness: (0, confidenceLabels_js_1.freshnessFromAge)(ts),
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
                schema: types_js_1.COGNITIVE_EVENT_SCHEMA,
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
                schema: types_js_1.COGNITIVE_EVENT_SCHEMA,
                id,
                timestamp: ts,
                title: focus,
                summary: 'Current project focus',
                files: [],
                impact: [],
                freshness: (0, confidenceLabels_js_1.freshnessFromAge)(ts),
                source: [sourceFromWriter(writer), 'manual'],
                provenance: ['focus_note'],
            });
        }
    }
    const linked = (0, snapshotEngine_js_1.linkEventVersions)(events);
    for (const evt of linked) {
        await (0, eventStore_js_1.writeCognitiveEvent)(workspaceRoot, evt);
    }
    return linked.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
function titleTokens(title) {
    return new Set(title
        .toLowerCase()
        .split(/[^\w]+/)
        .filter((t) => t.length > 3));
}
function applyAdrLifecycle(records) {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        if (cur.status === 'rejected' || cur.status === 'deprecated') {
            continue;
        }
        for (let j = i + 1; j < sorted.length; j++) {
            const newer = sorted[j];
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
async function syncDecisionCenter(workspaceRoot) {
    const graph = await (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot);
    const events = await (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot);
    const records = [];
    let seq = 1;
    for (const node of graph?.nodes ?? []) {
        const id = `ADR-${String(seq).padStart(3, '0')}`;
        seq += 1;
        const related = events
            .filter((e) => e.linked_decision_id === node.decision_id)
            .map((e) => e.id);
        const record = {
            schema: types_js_1.ADR_RECORD_SCHEMA,
            id,
            title: node.title,
            status: 'accepted',
            date: (node.timestamp || new Date().toISOString()).slice(0, 10),
            reason: node.reason,
            alternatives: node.alternatives?.length ? node.alternatives : ['no change', 'defer'],
            risk: (0, confidenceLabels_js_2.riskFromReversibility)(node.reversibility),
            related_events: related,
            edges: related,
            freshness: (0, confidenceLabels_js_1.freshnessFromAge)(node.timestamp),
            last_verified: node.timestamp,
        };
        await (0, eventStore_js_1.writeAdrRecord)(workspaceRoot, record);
        records.push(record);
    }
    const log = await (0, decisionLog_js_1.readDecisionLog)(workspaceRoot);
    for (const entry of log?.entries ?? []) {
        const id = `ADR-${String(seq).padStart(3, '0')}`;
        seq += 1;
        const related = events
            .filter((e) => e.linked_decision_id === entry.decision_id)
            .map((e) => e.id);
        const record = {
            schema: types_js_1.ADR_RECORD_SCHEMA,
            id,
            title: entry.selected,
            status: 'accepted',
            date: entry.created_at.slice(0, 10),
            reason: entry.reason,
            alternatives: ['alternative not recorded'],
            risk: 'medium',
            related_events: related,
            edges: related,
            freshness: (0, confidenceLabels_js_1.freshnessFromAge)(entry.created_at),
            last_verified: entry.created_at,
        };
        await (0, eventStore_js_1.writeAdrRecord)(workspaceRoot, record);
        records.push(record);
    }
    const withLifecycle = (0, decisionLifecycle_js_1.applyImplementedStatus)(applyAdrLifecycle(records));
    for (const adr of withLifecycle) {
        await (0, eventStore_js_1.writeAdrRecord)(workspaceRoot, adr);
    }
    return withLifecycle;
}
