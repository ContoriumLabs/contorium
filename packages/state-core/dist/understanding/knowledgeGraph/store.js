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
exports.readProjectKnowledgeGraph = readProjectKnowledgeGraph;
exports.readKnowledgeSnapshot = readKnowledgeSnapshot;
exports.writeProjectKnowledgeGraph = writeProjectKnowledgeGraph;
exports.deleteProjectKnowledgeGraph = deleteProjectKnowledgeGraph;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const normalize_js_1 = require("./normalize.js");
function graphDir(workspaceRoot) {
    return path.join(workspaceRoot, '.contora', 'graph');
}
function knowledgePath(workspaceRoot) {
    return path.join(graphDir(workspaceRoot), 'knowledge.json');
}
function snapshotPath(workspaceRoot) {
    return path.join(graphDir(workspaceRoot), 'snapshot.json');
}
async function readJson(filePath) {
    try {
        const text = await fs.readFile(filePath, 'utf8');
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
async function readProjectKnowledgeGraph(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const kg = await readJson(knowledgePath(root));
    return (0, normalize_js_1.normalizeKnowledgeGraph)(kg, root);
}
/** Snapshot Layer — compact graph summary for Handoff / MCP. */
async function readKnowledgeSnapshot(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const snap = await readJson(snapshotPath(root));
    if (snap?.topIntents) {
        return snap;
    }
    const kg = await readProjectKnowledgeGraph(root);
    return kg?.snapshot;
}
async function writeProjectKnowledgeGraph(workspaceRoot, graph) {
    const root = path.resolve(workspaceRoot);
    await writeJson(knowledgePath(root), graph);
    await writeGraphShards(root, graph);
}
/** Split shards for MCP / tooling (mirrors V3.1 doc layout). */
async function writeGraphShards(root, kg) {
    const dir = graphDir(root);
    const intents = kg.nodes.filter((n) => n.type === 'intent');
    const functions = kg.nodes.filter((n) => n.type === 'function' || n.type === 'class');
    const shardMeta = {
        schemaVersion: kg.meta.schemaVersion,
        generatedAt: kg.meta.generatedAt,
        graphBuildId: kg.meta.graphBuildId,
    };
    await Promise.all([
        writeJson(path.join(dir, 'metadata.json'), kg.meta),
        writeJson(path.join(dir, 'snapshot.json'), kg.snapshot),
        writeJson(path.join(dir, 'hotspots.json'), {
            ...shardMeta,
            hotspots: kg.hotspots,
        }),
        writeJson(path.join(dir, 'nodes.json'), { ...shardMeta, nodes: kg.nodes }),
        writeJson(path.join(dir, 'intents.json'), { ...shardMeta, nodes: intents }),
        writeJson(path.join(dir, 'functions.json'), { ...shardMeta, nodes: functions }),
        writeJson(path.join(dir, 'edges.json'), { ...shardMeta, edges: kg.edges }),
    ]);
}
async function deleteProjectKnowledgeGraph(workspaceRoot) {
    const dir = graphDir(workspaceRoot);
    for (const name of [
        'knowledge.json',
        'metadata.json',
        'snapshot.json',
        'hotspots.json',
        'nodes.json',
        'intents.json',
        'functions.json',
        'edges.json',
    ]) {
        try {
            await fs.unlink(path.join(dir, name));
        }
        catch {
            /* absent */
        }
    }
}
