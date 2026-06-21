"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProvenanceChain = readProvenanceChain;
exports.queryProvenanceChain = queryProvenanceChain;
exports.deriveProvenanceChains = deriveProvenanceChains;
const paths_js_1 = require("../paths.js");
const decisionProvenance_js_1 = require("../decisionProvenance.js");
const intentVNext_js_1 = require("../intentVNext.js");
const whyLayer_js_1 = require("../whyLayer.js");
const types_js_1 = require("../types.js");
const projectTimeline_js_1 = require("../dimensions/projectTimeline.js");
const io_js_1 = require("../dimensions/io.js");
async function readProvenanceChain(workspaceRoot) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.provenanceChainPath)(workspaceRoot));
    if (raw?.schema === types_js_1.PROVENANCE_CHAIN_SCHEMA && Array.isArray(raw.entries)) {
        return raw;
    }
    return null;
}
function queryProvenanceChain(artifact, anchor) {
    if (!anchor) {
        return [...artifact.entries];
    }
    const needle = anchor.toLowerCase();
    return artifact.entries.filter((e) => e.query_anchor.toLowerCase().includes(needle) ||
        e.chain.some((l) => l.entity_id.toLowerCase().includes(needle) ||
            l.label.toLowerCase().includes(needle) ||
            l.layer.toLowerCase().includes(needle)));
}
function buildChainForAnchor(anchor, why, decision, intent, timelineEvent) {
    const chain = [];
    if (why) {
        chain.push({
            layer: 'why',
            entity_id: why.feature,
            label: why.why,
        });
    }
    if (decision) {
        chain.push({
            layer: 'decision',
            entity_id: decision.decision_id,
            label: decision.title,
            timestamp: decision.timestamp,
        });
    }
    if (intent) {
        chain.push({
            layer: 'intent',
            entity_id: intent.intent_id,
            label: intent.name,
            timestamp: intent.updated_at,
        });
    }
    if (timelineEvent) {
        chain.push({
            layer: 'timeline',
            entity_id: timelineEvent.event_id,
            label: timelineEvent.impact_summary ?? 'timeline event',
            timestamp: new Date(timelineEvent.timestamp).toISOString(),
        });
    }
    return {
        query_anchor: anchor,
        chain,
        updated_at: new Date().toISOString(),
    };
}
/** Derive trace-back chains: WHY → DECISION → INTENT → TIMELINE (descriptive only). */
async function deriveProvenanceChains(workspaceRoot) {
    const [whyLayer, decisionGraph, intentGraph, timeline] = await Promise.all([
        (0, whyLayer_js_1.readWhyLayer)(workspaceRoot),
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
        (0, projectTimeline_js_1.readProjectEvolutionTimeline)(workspaceRoot),
    ]);
    const entries = [];
    for (const feature of whyLayer?.features ?? []) {
        const decision = decisionGraph?.nodes.find((n) => n.decision_id === feature.origin_decision || n.linked_intent === feature.linked_intent);
        const intent = intentGraph?.nodes.find((n) => n.intent_id === feature.linked_intent);
        const evt = timeline?.events.find((e) => e.linked_intent === feature.linked_intent || e.linked_decision === feature.origin_decision);
        entries.push(buildChainForAnchor(feature.feature, feature, decision, intent, evt));
    }
    for (const node of decisionGraph?.nodes ?? []) {
        if (entries.some((e) => e.query_anchor === node.title)) {
            continue;
        }
        const intent = intentGraph?.nodes.find((n) => n.intent_id === node.linked_intent);
        const evt = timeline?.events.find((e) => e.linked_decision === node.decision_id);
        entries.push(buildChainForAnchor(node.title, undefined, node, intent, evt));
    }
    const artifact = {
        schema: types_js_1.PROVENANCE_CHAIN_SCHEMA,
        updated_at: new Date().toISOString(),
        entries: entries.slice(0, 48),
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.provenanceChainPath)(workspaceRoot), artifact);
    return artifact;
}
