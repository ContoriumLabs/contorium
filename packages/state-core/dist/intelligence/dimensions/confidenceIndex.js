"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveConfidenceFromSignals = deriveConfidenceFromSignals;
exports.readConfidenceIndex = readConfidenceIndex;
exports.queryConfidenceIndex = queryConfidenceIndex;
exports.writeConfidenceIndex = writeConfidenceIndex;
const paths_js_1 = require("../paths.js");
const types_js_1 = require("../types.js");
const io_js_1 = require("./io.js");
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}
function classifyConfidence(score) {
    if (score >= 0.8) {
        return 'stable';
    }
    if (score >= 0.5) {
        return 'evolving';
    }
    return 'experimental';
}
/** Descriptive confidence scoring — not prescriptive recommendations. */
function deriveConfidenceFromSignals(signals) {
    const changeNorm = sigmoid(signals.change_frequency - 2) * 0.3;
    const decisionVol = Math.min(1, signals.decision_volatility / 5) * 0.35;
    const intentInst = Math.min(1, signals.intent_changes / 4) * 0.35;
    const uncertainty = changeNorm + decisionVol + intentInst;
    const confidence_score = Math.max(0, Math.min(1, Math.round((1 - uncertainty) * 100) / 100));
    const category = classifyConfidence(confidence_score);
    const freshness = signals.change_frequency > 1 || signals.intent_changes > 0 ? 'recent' : 'historical';
    return {
        entry: {
            confidence_score,
            category,
            freshness,
            signal_sources: signals,
        },
        meta: {
            confidence: confidence_score,
            category,
            freshness,
        },
    };
}
async function readConfidenceIndex(workspaceRoot) {
    let raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.confidenceIndexPath)(workspaceRoot));
    if (!raw) {
        raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.legacyStabilityIndexPath)(workspaceRoot));
    }
    if (raw?.schema === types_js_1.CONFIDENCE_INDEX_SCHEMA && Array.isArray(raw.entities)) {
        return raw;
    }
    // Legacy stability_index.v1 migration on read
    const legacy = await (0, io_js_1.readJsonFile)((0, paths_js_1.legacyStabilityIndexPath)(workspaceRoot));
    if (legacy?.schema === 'stability_index.v1' && Array.isArray(legacy.entities)) {
        return {
            schema: types_js_1.CONFIDENCE_INDEX_SCHEMA,
            updated_at: legacy.updated_at,
            entities: legacy.entities.map((e) => ({
                entity_id: String(e.entity_id ?? ''),
                confidence_score: Number(e.stability_score ?? e.confidence ?? 0.5),
                category: (e.stability_state ?? e.category ?? 'evolving'),
                freshness: (e.freshness ?? 'historical'),
                signal_sources: {
                    change_frequency: Number(e.signal_sources?.git_frequency ?? 0),
                    decision_volatility: Number(e.signal_sources?.decision_rewrites ?? 0),
                    intent_changes: Number(e.signal_sources?.intent_changes ?? 0),
                },
                updated_at: String(e.updated_at ?? legacy.updated_at),
            })),
        };
    }
    return null;
}
function queryConfidenceIndex(index, entityId) {
    if (!entityId) {
        return [...index.entities];
    }
    const needle = entityId.toLowerCase();
    return index.entities.filter((e) => e.entity_id.toLowerCase().includes(needle));
}
async function writeConfidenceIndex(workspaceRoot, entities) {
    const artifact = {
        schema: types_js_1.CONFIDENCE_INDEX_SCHEMA,
        updated_at: new Date().toISOString(),
        entities: entities.slice(0, 64),
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.confidenceIndexPath)(workspaceRoot), artifact);
    return artifact;
}
