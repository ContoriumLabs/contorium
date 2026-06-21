"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveProjectIntelligenceHealth = deriveProjectIntelligenceHealth;
exports.readProjectIntelligenceHealth = readProjectIntelligenceHealth;
const decisionProvenance_js_1 = require("../decisionProvenance.js");
const intentVNext_js_1 = require("../intentVNext.js");
const whyLayer_js_1 = require("../whyLayer.js");
const impactGraph_js_1 = require("../dimensions/impactGraph.js");
const confidenceIndex_js_1 = require("../dimensions/confidenceIndex.js");
const projectTimeline_js_1 = require("../dimensions/projectTimeline.js");
const provenanceChain_js_1 = require("../systems/provenanceChain.js");
const evolutionGraph_js_1 = require("../systems/evolutionGraph.js");
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
const types_js_1 = require("../types.js");
const paths_js_1 = require("../paths.js");
const io_js_1 = require("../dimensions/io.js");
const health_js_1 = require("../metrics/health.js");
const coverage_js_1 = require("../metrics/coverage.js");
function clamp01(n) {
    return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}
/** v1.2+ — intelligence asset completeness & weighted health score */
async function deriveProjectIntelligenceHealth(workspaceRoot) {
    const [state, intent, decisionGraph, why, timeline, impact, confidence, provenance, evolution, coverage,] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot),
        (0, whyLayer_js_1.readWhyLayer)(workspaceRoot),
        (0, projectTimeline_js_1.readProjectEvolutionTimeline)(workspaceRoot),
        (0, impactGraph_js_1.readImpactGraph)(workspaceRoot),
        (0, confidenceIndex_js_1.readConfidenceIndex)(workspaceRoot),
        (0, provenanceChain_js_1.readProvenanceChain)(workspaceRoot),
        (0, evolutionGraph_js_1.readEvolutionGraph)(workspaceRoot),
        (0, coverage_js_1.deriveKnowledgeCoverage)(workspaceRoot),
    ]);
    const layerFlags = [
        Boolean(state?.sessionId),
        Boolean(intent?.nodes?.length),
        Boolean(decisionGraph?.nodes?.length),
        Boolean(why?.features?.length),
        Boolean(timeline?.events?.length),
        Boolean(impact?.entries?.length),
        Boolean(confidence?.entities?.length),
        Boolean(provenance?.entries?.length),
        Boolean(evolution?.chains?.length),
    ];
    const intelligence_completeness = clamp01(layerFlags.filter(Boolean).length / layerFlags.length);
    const decisions = decisionGraph?.nodes ?? [];
    const withIntent = decisions.filter((d) => d.linked_intent?.trim()).length;
    const decision_coverage = decisions.length ? clamp01(withIntent / decisions.length) : 0;
    const intents = intent?.nodes ?? [];
    const linked = intents.filter((i) => (i.linked_decisions?.length ?? 0) > 0).length;
    const intent_linkage = intents.length ? clamp01(linked / intents.length) : 0;
    const provEntries = provenance?.entries ?? [];
    const fullChains = provEntries.filter((e) => e.chain.length >= 3).length;
    const provenance_coverage = provEntries.length ? clamp01(fullChains / provEntries.length) : 0;
    const base = {
        intelligence_completeness,
        decision_coverage,
        intent_linkage,
        provenance_coverage,
        knowledge_coverage: coverage.knowledge_coverage,
    };
    const health_score = (0, health_js_1.computeHealthScore)(base);
    const health_category = (0, health_js_1.classifyHealthScore)(health_score);
    const metrics = {
        ...base,
        health_score,
        health_category,
    };
    const health = {
        schema: types_js_1.PROJECT_INTELLIGENCE_HEALTH_SCHEMA,
        updated_at: new Date().toISOString(),
        metrics,
        coverage_detail: {
            covered_modules: coverage.covered_modules.slice(0, 24),
            total_modules: coverage.total_modules.slice(0, 24),
        },
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.intelligenceHealthPath)(workspaceRoot), health);
    return health;
}
async function readProjectIntelligenceHealth(workspaceRoot) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.intelligenceHealthPath)(workspaceRoot));
    if (raw?.schema === types_js_1.PROJECT_INTELLIGENCE_HEALTH_SCHEMA && raw.metrics) {
        return raw;
    }
    return null;
}
