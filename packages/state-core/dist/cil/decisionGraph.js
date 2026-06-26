"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDecisionGraphFromAdrs = buildDecisionGraphFromAdrs;
exports.persistDecisionGraph = persistDecisionGraph;
exports.readDecisionGraph = readDecisionGraph;
const paths_js_1 = require("./paths.js");
const io_js_1 = require("../intelligence/dimensions/io.js");
const types_js_1 = require("./types.js");
function buildDecisionGraphFromAdrs(adrs) {
    const nodes = adrs.map((adr) => {
        const edges = [...adr.related_events];
        if (adr.superseded_by) {
            edges.push(adr.superseded_by);
        }
        for (const other of adrs) {
            if (other.id !== adr.id && other.superseded_by === adr.id) {
                edges.push(other.id);
            }
        }
        return {
            id: adr.id,
            title: adr.title,
            status: adr.status,
            reason: adr.reason,
            edges: [...new Set(edges)],
            effective_range: {
                from: adr.date,
                to: adr.status === 'superseded' ? adr.last_verified?.slice(0, 10) : undefined,
            },
        };
    });
    return {
        schema: types_js_1.DECISION_GRAPH_SCHEMA,
        updated_at: new Date().toISOString(),
        nodes,
        projection_of: 'cognitive_events',
        derived_from: adrs.flatMap((a) => a.related_events).slice(0, 64),
    };
}
async function persistDecisionGraph(workspaceRoot, adrs) {
    const graph = buildDecisionGraphFromAdrs(adrs);
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.decisionGraphPath)(workspaceRoot), graph);
    return graph;
}
async function readDecisionGraph(workspaceRoot) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.decisionGraphPath)(workspaceRoot));
    if (raw?.schema === types_js_1.DECISION_GRAPH_SCHEMA && Array.isArray(raw.nodes)) {
        return raw;
    }
    return null;
}
