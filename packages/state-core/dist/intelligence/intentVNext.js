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
exports.readIntentNodesVNext = readIntentNodesVNext;
exports.deriveIntentGraphVNext = deriveIntentGraphVNext;
exports.mirrorIntentGraphVNext = mirrorIntentGraphVNext;
exports.projectIntentGraphVNext = projectIntentGraphVNext;
exports.readIntentGraphVNext = readIntentGraphVNext;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const paths_js_1 = require("./paths.js");
const types_js_1 = require("./types.js");
async function readLegacyIntentGraph(workspaceRoot) {
    try {
        const text = await fs.readFile((0, paths_js_1.legacyIntentGraphPath)(workspaceRoot), 'utf8');
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
function toVNextNode(node) {
    const now = new Date(node.lastUpdated ?? node.learnedAt ?? Date.now()).toISOString();
    const modules = (node.relatedFiles ?? [])
        .map((f) => f.replace(/\\/g, '/').split('/')[0])
        .filter(Boolean);
    return {
        intent_id: node.id,
        title: node.text.length > 64 ? `${node.text.slice(0, 61)}…` : node.text,
        name: node.text.length > 64 ? `${node.text.slice(0, 61)}…` : node.text,
        description: node.text,
        why: node.text,
        design_principles: [],
        constraints: node.relatedFiles?.length ? [`scoped to ${node.relatedFiles.length} path(s)`] : [],
        related_modules: [...new Set(modules)],
        linked_decisions: [],
        created_at: now,
        updated_at: now,
    };
}
async function readIntentNodesVNext(workspaceRoot) {
    try {
        const text = await fs.readFile((0, paths_js_1.intentNodesPath)(workspaceRoot), 'utf8');
        const raw = JSON.parse(text);
        return Array.isArray(raw.nodes) ? raw.nodes : [];
    }
    catch {
        const legacy = await readLegacyIntentGraph(workspaceRoot);
        return (legacy?.nodes ?? []).map(toVNextNode);
    }
}
async function deriveIntentGraphVNext(workspaceRoot) {
    const legacy = await readLegacyIntentGraph(workspaceRoot);
    if (!legacy?.nodes?.length) {
        return null;
    }
    const nodes = legacy.nodes.map(toVNextNode);
    const graph = {
        schema: types_js_1.INTENT_VNEXT_SCHEMA,
        updated_at: new Date(legacy.updatedAt ?? Date.now()).toISOString(),
        nodes,
        edges: (legacy.edges ?? []).map((e) => ({ from: e.from, to: e.to, type: e.type })),
    };
    await fs.mkdir(path.dirname((0, paths_js_1.intentNodesPath)(workspaceRoot)), { recursive: true });
    await Promise.all([
        fs.writeFile((0, paths_js_1.intentGraphVNextPath)(workspaceRoot), `${JSON.stringify(graph, null, 2)}\n`, 'utf8'),
        fs.writeFile((0, paths_js_1.intentNodesPath)(workspaceRoot), `${JSON.stringify({ nodes }, null, 2)}\n`, 'utf8'),
    ]);
    return graph;
}
/** @deprecated Use deriveIntentGraphVNext — reflects legacy intent-graph into vNext paths. */
async function mirrorIntentGraphVNext(workspaceRoot) {
    return deriveIntentGraphVNext(workspaceRoot);
}
/** Project (write) vNext intent graph from caller-supplied nodes. */
async function projectIntentGraphVNext(workspaceRoot, graph) {
    await fs.mkdir(path.dirname((0, paths_js_1.intentNodesPath)(workspaceRoot)), { recursive: true });
    await Promise.all([
        fs.writeFile((0, paths_js_1.intentGraphVNextPath)(workspaceRoot), `${JSON.stringify(graph, null, 2)}\n`, 'utf8'),
        fs.writeFile((0, paths_js_1.intentNodesPath)(workspaceRoot), `${JSON.stringify({ nodes: graph.nodes }, null, 2)}\n`, 'utf8'),
    ]);
}
async function readIntentGraphVNext(workspaceRoot) {
    try {
        const text = await fs.readFile((0, paths_js_1.intentGraphVNextPath)(workspaceRoot), 'utf8');
        const raw = JSON.parse(text);
        if (raw?.schema === types_js_1.INTENT_VNEXT_SCHEMA) {
            return raw;
        }
        return null;
    }
    catch {
        return deriveIntentGraphVNext(workspaceRoot);
    }
}
