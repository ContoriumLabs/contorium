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
exports.normalizeHandoff = normalizeHandoff;
exports.normalizeChange = normalizeChange;
exports.readProjectGraph = readProjectGraph;
exports.readChangeArtifact = readChangeArtifact;
exports.readHandoffArtifact = readHandoffArtifact;
exports.readProjectTimeline = readProjectTimeline;
exports.readImpactArtifact = readImpactArtifact;
exports.readIntentArtifact = readIntentArtifact;
exports.readUnderstandingGraph = readUnderstandingGraph;
exports.writeUnderstandingArtifacts = writeUnderstandingArtifacts;
exports.deleteUnderstandingArtifacts = deleteUnderstandingArtifacts;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const store_js_1 = require("./knowledgeGraph/store.js");
const LEGACY_ARTIFACTS = ['impact.json', 'intent.json'];
function contoraPath(workspaceRoot, name) {
    return path.join(workspaceRoot, '.contora', name);
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
async function unlinkQuiet(filePath) {
    try {
        await fs.unlink(filePath);
    }
    catch {
        /* absent */
    }
}
/** Normalize V3.0 handoff → V3.1 shape on read. */
function normalizeHandoff(raw) {
    if (!raw) {
        return undefined;
    }
    if (raw.version === 2 && 'current_focus' in raw) {
        return raw;
    }
    const v1 = raw;
    return {
        version: 2,
        generatedAt: v1.generatedAt,
        goal: v1.goal,
        current_focus: v1.intent,
        key_changes: [
            ...v1.changed.changedFiles.map((f) => ({
                symbol: f,
                kind: 'file',
                change_type: 'modified',
            })),
            ...v1.changed.changed_functions.map((s) => ({
                symbol: s,
                kind: 'function',
                change_type: 'modified',
            })),
            ...v1.changed.changed_classes.map((s) => ({
                symbol: s,
                kind: 'class',
                change_type: 'modified',
            })),
        ],
        impact_summary: {
            risk: v1.impact.risk_level,
            affected_modules: v1.impact.affected_modules,
            affected_functions: v1.impact.affected_functions,
            details: v1.impact.details,
        },
        next_actions: v1.next_actions.map((line) => ({
            action: 'continue',
            target: line.slice(0, 48),
            reason: line,
        })),
        context_graph_refs: [],
        summary: v1.summary,
    };
}
/** Normalize V3.0 change.json on read. */
function normalizeChange(raw) {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const r = raw;
    if (r.version === 2 && Array.isArray(r.key_changes)) {
        return raw;
    }
    const legacy = raw;
    const files = legacy.changedFiles ?? [];
    return {
        version: 2,
        generatedAt: legacy.generatedAt ?? Date.now(),
        changed_files: files,
        key_changes: [
            ...files.map((f) => ({ symbol: f, kind: 'file', change_type: 'modified' })),
            ...(legacy.changed_functions ?? []).map((s) => ({
                symbol: s,
                kind: 'function',
                change_type: 'modified',
            })),
            ...(legacy.changed_classes ?? []).map((s) => ({
                symbol: s,
                kind: 'class',
                change_type: 'modified',
            })),
        ],
    };
}
async function readProjectGraph(workspaceRoot) {
    const g = await readJson(contoraPath(workspaceRoot, 'graph.json'));
    if (!g) {
        return undefined;
    }
    return { ...g, version: 2 };
}
async function readChangeArtifact(workspaceRoot) {
    const raw = await readJson(contoraPath(workspaceRoot, 'change.json'));
    return normalizeChange(raw);
}
async function readHandoffArtifact(workspaceRoot) {
    const raw = await readJson(contoraPath(workspaceRoot, 'handoff.json'));
    return normalizeHandoff(raw);
}
async function readProjectTimeline(workspaceRoot) {
    return readJson(contoraPath(workspaceRoot, 'timeline.json'));
}
/** @deprecated V3.1 — impact merged into handoff.json */
async function readImpactArtifact(workspaceRoot) {
    const legacy = await readJson(contoraPath(workspaceRoot, 'impact.json'));
    if (legacy) {
        return legacy;
    }
    const handoff = await readHandoffArtifact(workspaceRoot);
    if (!handoff) {
        return undefined;
    }
    return {
        version: 1,
        generatedAt: handoff.generatedAt,
        affected_functions: handoff.impact_summary.affected_functions,
        affected_modules: handoff.impact_summary.affected_modules,
        risk: handoff.impact_summary.risk,
        risk_level: handoff.impact_summary.risk,
        details: handoff.impact_summary.details,
    };
}
function confidenceFromHandoff(handoff) {
    switch (handoff.impact_summary.risk) {
        case 'high':
            return 0.88;
        case 'medium':
            return 0.72;
        default:
            return 0.58;
    }
}
/** @deprecated V3.1 — intent merged into handoff.json */
async function readIntentArtifact(workspaceRoot) {
    const legacy = await readJson(contoraPath(workspaceRoot, 'intent.json'));
    if (legacy) {
        return legacy;
    }
    const handoff = await readHandoffArtifact(workspaceRoot);
    if (!handoff) {
        return undefined;
    }
    const kg = await (0, store_js_1.readProjectKnowledgeGraph)(workspaceRoot);
    const fromGraph = kg?.snapshot?.graphSummary?.avgConfidence;
    const confidence = fromGraph && fromGraph > 0 ? fromGraph : confidenceFromHandoff(handoff);
    return {
        version: 1,
        generatedAt: handoff.generatedAt,
        intent: handoff.current_focus,
        confidence,
        signals: handoff.key_changes.slice(0, 4).map((k) => k.symbol),
    };
}
async function readUnderstandingGraph(workspaceRoot) {
    return readJson(contoraPath(workspaceRoot, 'understanding_graph.json'));
}
async function writeUnderstandingArtifacts(workspaceRoot, artifacts) {
    const root = path.resolve(workspaceRoot);
    const writes = [
        writeJson(contoraPath(root, 'graph.json'), artifacts.graph),
        writeJson(contoraPath(root, 'change.json'), artifacts.change),
        writeJson(contoraPath(root, 'handoff.json'), artifacts.handoff),
        writeJson(contoraPath(root, 'timeline.json'), artifacts.timeline),
        ...LEGACY_ARTIFACTS.map((name) => unlinkQuiet(contoraPath(root, name))),
    ];
    if (artifacts.understandingGraph) {
        writes.push(writeJson(contoraPath(root, 'understanding_graph.json'), artifacts.understandingGraph));
    }
    await Promise.all(writes);
}
async function deleteUnderstandingArtifacts(workspaceRoot) {
    const names = ['graph.json', 'change.json', 'handoff.json', 'timeline.json', 'understanding_graph.json', ...LEGACY_ARTIFACTS];
    await Promise.all([
        ...names.map((name) => unlinkQuiet(contoraPath(workspaceRoot, name))),
        (0, store_js_1.deleteProjectKnowledgeGraph)(workspaceRoot),
    ]);
}
