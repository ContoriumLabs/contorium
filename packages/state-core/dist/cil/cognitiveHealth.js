"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCognitiveHealth = computeCognitiveHealth;
exports.persistCognitiveHealth = persistCognitiveHealth;
exports.readCognitiveHealthReport = readCognitiveHealthReport;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const intentVNext_js_1 = require("../intelligence/intentVNext.js");
const io_js_1 = require("../intelligence/dimensions/io.js");
const paths_js_1 = require("./paths.js");
const decisionConsistency_js_1 = require("./decisionConsistency.js");
const decisionGraph_js_1 = require("./decisionGraph.js");
const eventStore_js_1 = require("./eventStore.js");
const knowledgeGraph_js_1 = require("./knowledgeGraph.js");
const types_js_1 = require("./types.js");
const timeCoerce_js_1 = require("./timeCoerce.js");
const STALE_ADR_DAYS = 60;
const DEAD_FOCUS_DAYS = 14;
function daysSince(iso) {
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    const ms = Date.now() - parsed;
    return ms / (24 * 60 * 60 * 1000);
}
/** Cognitive Health — CIL-native quality signals for Dashboard / Action Engine. */
async function computeCognitiveHealth(workspaceRoot) {
    const warnings = [];
    const [events, adrs, state, intents, graph, entityIndex] = await Promise.all([
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot),
        (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot),
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
        (0, decisionGraph_js_1.readDecisionGraph)(workspaceRoot),
        (0, knowledgeGraph_js_1.readKnowledgeEntityIndex)(workspaceRoot),
    ]);
    const missingWhy = events.filter((e) => e.decision && !e.why && (e.impact.length > 0 || e.files.length > 0));
    if (missingWhy.length) {
        warnings.push({
            code: 'missing_why',
            message: `${missingWhy.length} event(s) missing WHY`,
            severity: missingWhy.length >= 3 ? 'high' : 'medium',
            refs: missingWhy.slice(0, 5).map((e) => e.id),
        });
    }
    const highImpactNoDecision = events.filter((e) => !e.decision && !e.linked_decision_id && e.files.length >= 3);
    if (highImpactNoDecision.length) {
        warnings.push({
            code: 'missing_decision',
            message: `${highImpactNoDecision.length} high-impact change(s) without linked decision`,
            severity: 'medium',
            refs: highImpactNoDecision.slice(0, 5).map((e) => e.id),
        });
    }
    const staleAdrs = adrs.filter((a) => (a.freshness === 'stale' || a.freshness === 'unknown') &&
        (a.last_verified ? daysSince(a.last_verified) > STALE_ADR_DAYS : true));
    if (staleAdrs.length) {
        warnings.push({
            code: 'stale_adr',
            message: `${staleAdrs.length} ADR(s) stale > ${STALE_ADR_DAYS} days`,
            severity: 'medium',
            refs: staleAdrs.slice(0, 5).map((a) => a.id),
        });
    }
    const focus = state?.currentTask?.trim();
    const lastUpdated = state?.lastUpdated;
    const focusUpdatedIso = lastUpdated != null ? (0, timeCoerce_js_1.coerceTimestampToIso)(lastUpdated) : undefined;
    if (focus && focusUpdatedIso && daysSince(focusUpdatedIso) > DEAD_FOCUS_DAYS) {
        warnings.push({
            code: 'dead_focus',
            message: `Focus unchanged > ${DEAD_FOCUS_DAYS} days: "${focus.slice(0, 48)}"`,
            severity: 'low',
        });
    }
    const intentNode = intents?.nodes?.[0];
    if (intentNode?.updated_at && daysSince(intentNode.updated_at) > STALE_ADR_DAYS) {
        warnings.push({
            code: 'stale_intent',
            message: `Primary intent not updated > ${STALE_ADR_DAYS} days`,
            severity: 'medium',
            refs: [intentNode.intent_id ?? intentNode.name],
        });
    }
    else if (intentNode?.cognition?.confidence != null && intentNode.cognition.confidence < 0.4) {
        warnings.push({
            code: 'stale_intent',
            message: `Primary intent confidence low (${Math.round(intentNode.cognition.confidence * 100)}%)`,
            severity: 'medium',
            refs: [intentNode.intent_id ?? intentNode.name],
        });
    }
    const linkedEventIds = new Set();
    if (entityIndex?.entities.length) {
        for (const _e of entityIndex.entities) {
            /* entity files checked below */
        }
    }
    for (const evt of events) {
        if (evt.provenance?.includes('focus_note') || evt.files.length) {
            linkedEventIds.add(evt.id);
        }
    }
    const orphans = events.filter((e) => !linkedEventIds.has(e.id) &&
        !e.linked_decision_id &&
        !entityIndex?.entities.some((ent) => ent.toLowerCase().includes(e.title.slice(0, 6).toLowerCase())));
    if (orphans.length >= 3) {
        warnings.push({
            code: 'orphan_event',
            message: `${orphans.length} orphan event(s) not linked to entities or decisions`,
            severity: 'low',
            refs: orphans.slice(0, 5).map((e) => e.id),
        });
    }
    if (graph) {
        const nodeIds = new Set(graph.nodes.map((n) => n.id));
        const broken = graph.nodes.filter((n) => n.edges.some((e) => !nodeIds.has(e) && !events.some((ev) => ev.id === e)));
        if (broken.length) {
            warnings.push({
                code: 'broken_graph',
                message: `${broken.length} decision graph node(s) with dangling edges`,
                severity: 'medium',
                refs: broken.slice(0, 5).map((n) => n.id),
            });
        }
    }
    const conflicts = (0, decisionConsistency_js_1.detectDecisionContradictions)(adrs);
    if (conflicts.length) {
        warnings.push({
            code: 'decision_conflict',
            message: `${conflicts.length} decision contradiction(s) detected`,
            severity: 'high',
            refs: conflicts.map((c) => `${c.decision}↔${c.by}`),
        });
    }
    const penalty = warnings.reduce((sum, w) => {
        if (w.severity === 'high') {
            return sum + 12;
        }
        if (w.severity === 'medium') {
            return sum + 6;
        }
        return sum + 3;
    }, 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const formatted = [
        'Cognitive Health',
        '',
        `Score: ${score}%`,
        '',
        warnings.length ? 'Warnings:' : 'No warnings — cognition layer healthy.',
        ...warnings.map((w) => `  ⚠ [${w.severity}] ${w.message}`),
    ];
    return {
        schema: types_js_1.COGNITIVE_HEALTH_SCHEMA,
        score,
        updated_at: new Date().toISOString(),
        projection_of: 'cognitive_events',
        derived_from: events.slice(0, 32).map((e) => e.id),
        warnings,
        formatted,
    };
}
async function persistCognitiveHealth(workspaceRoot) {
    const report = await computeCognitiveHealth(workspaceRoot);
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.cognitiveHealthPath)(workspaceRoot), report);
    return report;
}
async function readCognitiveHealthReport(workspaceRoot) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.cognitiveHealthPath)(workspaceRoot));
    if (raw?.schema === types_js_1.COGNITIVE_HEALTH_SCHEMA) {
        return raw;
    }
    return null;
}
