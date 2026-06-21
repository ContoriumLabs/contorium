"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readEvolutionGraph = readEvolutionGraph;
exports.queryEvolutionGraph = queryEvolutionGraph;
exports.deriveEvolutionGraph = deriveEvolutionGraph;
const paths_js_1 = require("../paths.js");
const decisionProvenance_js_1 = require("../decisionProvenance.js");
const intentVNext_js_1 = require("../intentVNext.js");
const types_js_1 = require("../types.js");
const projectTimeline_js_1 = require("../dimensions/projectTimeline.js");
const io_js_1 = require("../dimensions/io.js");
async function readEvolutionGraph(workspaceRoot) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.evolutionGraphPath)(workspaceRoot));
    if (raw?.schema === types_js_1.EVOLUTION_GRAPH_SCHEMA && Array.isArray(raw.chains)) {
        return raw;
    }
    return null;
}
function queryEvolutionGraph(artifact, topic) {
    if (!topic) {
        return [...artifact.chains];
    }
    const needle = topic.toLowerCase();
    return artifact.chains.filter((c) => c.topic.toLowerCase().includes(needle));
}
/**
 * Structured transformation chains (not chronological timeline).
 * Example: Auth V1 → JWT → Multi Tenant → SSO
 */
async function deriveEvolutionGraph(workspaceRoot) {
    const [timeline, decisionGraph, intentGraph] = await Promise.all([
        (0, projectTimeline_js_1.readProjectEvolutionTimeline)(workspaceRoot),
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
    ]);
    const chains = [];
    const topics = new Map();
    for (const intent of intentGraph?.nodes ?? []) {
        const key = intent.related_modules[0] ?? intent.intent_id;
        const nodes = topics.get(key) ?? [];
        nodes.push({
            node_id: intent.intent_id,
            label: intent.name,
            stage: 'intent',
            linked_intent: intent.intent_id,
        });
        topics.set(key, nodes);
    }
    for (const decision of decisionGraph?.nodes ?? []) {
        const key = decision.linked_intent || (decision.impact_scope[0] ?? decision.decision_id);
        const nodes = topics.get(key) ?? [];
        nodes.push({
            node_id: decision.decision_id,
            label: decision.selected,
            stage: 'decision',
            linked_intent: decision.linked_intent,
            linked_decision: decision.decision_id,
        });
        topics.set(key, nodes);
    }
    for (const evt of timeline?.events ?? []) {
        if (evt.event_type !== 'decision' && evt.event_type !== 'milestone' && evt.event_type !== 'refactor') {
            continue;
        }
        const key = evt.linked_intent ?? evt.entity_id;
        const nodes = topics.get(key) ?? [];
        nodes.push({
            node_id: evt.event_id,
            label: evt.impact_summary ?? evt.event_type,
            stage: evt.event_type,
            linked_intent: evt.linked_intent,
            linked_decision: evt.linked_decision,
        });
        topics.set(key, nodes);
    }
    for (const [topic, nodes] of topics) {
        if (nodes.length < 2) {
            continue;
        }
        chains.push({
            chain_id: `evo_${topic.replace(/[^\w]+/g, '_')}`,
            topic,
            nodes: nodes.slice(0, 12),
            updated_at: new Date().toISOString(),
        });
    }
    const artifact = {
        schema: types_js_1.EVOLUTION_GRAPH_SCHEMA,
        updated_at: new Date().toISOString(),
        chains: chains.slice(0, 24),
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.evolutionGraphPath)(workspaceRoot), artifact);
    return artifact;
}
