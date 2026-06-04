"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraphMetadata = buildGraphMetadata;
exports.normalizeKnowledgeGraph = normalizeKnowledgeGraph;
const types_js_1 = require("./types.js");
const version_js_1 = require("../../version.js");
const snapshotBuilder_js_1 = require("./snapshotBuilder.js");
const hotspotBuilder_js_1 = require("./hotspotBuilder.js");
const closureConstants_js_1 = require("./closureConstants.js");
const confidence_js_1 = require("./confidence.js");
function workspaceIdFromRoot(root) {
    let h = 0;
    const s = root.replace(/\\/g, '/');
    for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(16).slice(0, 12);
}
function buildGraphMetadata(args) {
    return {
        version: types_js_1.KNOWLEDGE_ENGINE_VERSION,
        schemaVersion: types_js_1.KNOWLEDGE_SCHEMA_VERSION,
        closureVersion: closureConstants_js_1.CLOSURE_VERSION,
        generatedAt: args.now,
        workspaceId: workspaceIdFromRoot(args.workspaceRoot),
        graphBuildId: `graph_${args.now.toString(36)}`,
        sourceVersion: args.sourceVersion ?? (0, version_js_1.getContoriumPackageVersion)(),
        rebuildTrigger: args.rebuildTrigger,
        lastCommitHash: args.lastCommitHash,
    };
}
function withEdgeConfidence(edges) {
    return edges.map((e) => ({
        ...e,
        confidence: e.confidence ?? (e.type === 'supports_intent' ? e.weight : 0.85),
    }));
}
function withMappingConfidence(mappings) {
    return mappings.map((m) => ({
        ...m,
        confidence: m.confidence ?? m.score,
    }));
}
/** schemaVersion switch — upgrade legacy graphs on read. */
function normalizeKnowledgeGraph(raw, workspaceRoot) {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const r = raw;
    if (r.meta && typeof r.meta === 'object') {
        const kg = raw;
        const schema = (kg.meta.schemaVersion ?? types_js_1.KNOWLEDGE_SCHEMA_VERSION).toString();
        if (schema !== types_js_1.KNOWLEDGE_SCHEMA_VERSION) {
            return upgradeSchema(kg, workspaceRoot);
        }
        return {
            ...kg,
            edges: (0, confidence_js_1.filterCanonicalEdges)(withEdgeConfidence(kg.edges ?? [])),
            intentMappings: withMappingConfidence(kg.intentMappings ?? []),
            inferenceMappings: kg.inferenceMappings ?? [],
            hotspots: (kg.hotspots ?? []).map((h) => ({
                ...h,
                lifecycle: h.lifecycle ?? 'active',
            })),
            snapshot: kg.snapshot ??
                (0, snapshotBuilder_js_1.buildKnowledgeSnapshot)({
                    nodes: kg.nodes,
                    edges: kg.edges,
                    intentMappings: kg.intentMappings,
                    hotspots: kg.hotspots ?? [],
                    nextActions: [],
                    now: kg.meta.generatedAt,
                }),
        };
    }
    if (r.version === 1) {
        return migrateLegacyV1(raw, workspaceRoot);
    }
    return undefined;
}
function upgradeSchema(kg, workspaceRoot) {
    return normalizeKnowledgeGraph({
        ...kg,
        meta: { ...kg.meta, schemaVersion: types_js_1.KNOWLEDGE_SCHEMA_VERSION },
    }, workspaceRoot);
}
function migrateLegacyV1(legacy, workspaceRoot) {
    const edges = (legacy.edges ?? []).map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        weight: e.weight,
        confidence: e.confidence ?? (e.type === 'supports_intent' ? e.weight : 0.85),
    }));
    const intentMappings = (legacy.intentMappings ?? []).map((m) => ({
        intentId: m.intentId,
        functionId: m.functionId,
        score: m.score,
        confidence: m.confidence ?? m.score,
        signals: m.signals,
    }));
    const { canonical, inference } = (0, confidence_js_1.splitMappingsByCanonicalThreshold)(intentMappings);
    const partial = {
        nodes: legacy.nodes ?? [],
        edges: (0, confidence_js_1.filterCanonicalEdges)(edges),
        intentMappings: canonical,
        inferenceMappings: inference,
        reasonTraces: legacy.reasonTraces ?? [],
        intentTrees: legacy.intentTrees ?? [],
    };
    const hotspots = (0, hotspotBuilder_js_1.buildHotspots)({
        nodes: partial.nodes,
        edges: partial.edges,
        intentMappings: partial.intentMappings,
        editCounts: new Map(),
        gitFrequency: new Map(),
        now: legacy.generatedAt,
    });
    const snapshot = (0, snapshotBuilder_js_1.buildKnowledgeSnapshot)({
        nodes: partial.nodes,
        edges: partial.edges,
        intentMappings: partial.intentMappings,
        hotspots,
        nextActions: [],
        now: legacy.generatedAt,
    });
    return {
        meta: buildGraphMetadata({
            workspaceRoot: workspaceRoot ?? 'unknown',
            now: legacy.generatedAt,
        }),
        ...partial,
        hotspots,
        snapshot,
    };
}
