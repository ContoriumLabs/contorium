"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDecisionProvenanceNode = void 0;
exports.readDecisionProvenanceGraph = readDecisionProvenanceGraph;
exports.deriveDecisionProvenanceNode = deriveDecisionProvenanceNode;
exports.appendDecisionProvenanceNode = appendDecisionProvenanceNode;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const paths_js_1 = require("./paths.js");
const types_js_1 = require("./types.js");
async function readJson(filePath) {
    try {
        const text = await fs.readFile(filePath, 'utf8');
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
async function readDecisionProvenanceGraph(workspaceRoot) {
    let raw = await readJson((0, paths_js_1.decisionGraphPath)(workspaceRoot));
    if (!raw) {
        raw = await readJson((0, paths_js_1.legacyDecisionGraphPath)(workspaceRoot));
    }
    if (raw?.schema === types_js_1.DECISION_PROVENANCE_SCHEMA && Array.isArray(raw.nodes)) {
        return raw;
    }
    return null;
}
function reversibilityFromAction(action) {
    if (action === 'block') {
        return 'low';
    }
    if (action === 'warn' || action === 'inject_fix') {
        return 'medium';
    }
    return 'high';
}
function deriveDecisionProvenanceNode(input) {
    const { review, action } = input;
    const chain = review.reason_chain ?? [];
    const ts = review.review_timestamp || new Date(review.generatedAt || Date.now()).toISOString();
    const decisionId = `dec_${review.file.replace(/[^\w]+/g, '_')}_${Date.parse(ts) || Date.now()}`;
    return {
        decision_id: decisionId,
        title: `${review.change_type} · ${review.file}`,
        context: review.recommendation.replace(/_/g, ' '),
        alternatives: chain.length > 1 ? chain.slice(0, -1) : ['no change', 'defer review'],
        selected: review.recommendation,
        reason: chain.join(' → ') || review.impact,
        tradeoffs: [review.impact, review.risk].filter(Boolean),
        impact_scope: [review.file, ...(review.staged_files ?? [])].slice(0, 12),
        linked_intent: input.linked_intent ?? review.file.split('/')[0] ?? 'project',
        reversibility: reversibilityFromAction(action),
        timestamp: ts,
    };
}
/** @deprecated Use deriveDecisionProvenanceNode */
exports.buildDecisionProvenanceNode = deriveDecisionProvenanceNode;
async function appendDecisionProvenanceNode(workspaceRoot, node) {
    const existing = (await readDecisionProvenanceGraph(workspaceRoot)) ?? {
        schema: types_js_1.DECISION_PROVENANCE_SCHEMA,
        updated_at: new Date().toISOString(),
        nodes: [],
        edges: [],
    };
    const nodes = [...existing.nodes.filter((n) => n.decision_id !== node.decision_id), node].slice(-64);
    const edges = [...existing.edges];
    if (nodes.length > 1) {
        const prev = nodes[nodes.length - 2];
        edges.push({ from: prev.decision_id, to: node.decision_id, relation: 'evolved_from' });
    }
    const graph = {
        schema: types_js_1.DECISION_PROVENANCE_SCHEMA,
        updated_at: new Date().toISOString(),
        nodes,
        edges: edges.slice(-128),
    };
    await writeJson((0, paths_js_1.decisionGraphPath)(workspaceRoot), graph);
    await writeJson((0, paths_js_1.legacyDecisionGraphPath)(workspaceRoot), graph).catch(() => undefined);
    const { appendDecisionLogEntry } = await Promise.resolve().then(() => __importStar(require('./systems/decisionLog.js')));
    await appendDecisionLogEntry(workspaceRoot, node).catch(() => undefined);
    return graph;
}
