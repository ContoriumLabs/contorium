"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveProjectState = retrieveProjectState;
exports.retrieveIntentGraph = retrieveIntentGraph;
exports.retrieveDecisionBundle = retrieveDecisionBundle;
exports.retrieveTimeline = retrieveTimeline;
exports.retrieveGraph = retrieveGraph;
exports.retrieveConfidence = retrieveConfidence;
exports.retrieveImpact = retrieveImpact;
exports.retrieveWhy = retrieveWhy;
exports.retrieveHealth = retrieveHealth;
exports.retrieveEvolution = retrieveEvolution;
exports.retrieveProvenance = retrieveProvenance;
exports.retrieveHandoff = retrieveHandoff;
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
const adapterSync_js_1 = require("../../adapterSync.js");
const store_js_1 = require("../../state-builder/store.js");
const intentVNext_js_1 = require("../../intelligence/intentVNext.js");
const decisionProvenance_js_1 = require("../../intelligence/decisionProvenance.js");
const governanceArtifacts_js_1 = require("../../governance/governanceArtifacts.js");
const decisionLog_js_1 = require("../../intelligence/systems/decisionLog.js");
const projectTimeline_js_1 = require("../../intelligence/dimensions/projectTimeline.js");
const store_js_2 = require("../../understanding/store.js");
const confidenceIndex_js_1 = require("../../intelligence/dimensions/confidenceIndex.js");
const impactGraph_js_1 = require("../../intelligence/dimensions/impactGraph.js");
const whyLayer_js_1 = require("../../intelligence/whyLayer.js");
const projectIntelligenceHealth_js_1 = require("../../intelligence/health/projectIntelligenceHealth.js");
const evolutionGraph_js_1 = require("../../intelligence/systems/evolutionGraph.js");
const provenanceChain_js_1 = require("../../intelligence/systems/provenanceChain.js");
const store_js_3 = require("../../understanding/store.js");
/** PIL Retrieve — workspace state bundle. */
async function retrieveProjectState(workspaceRoot) {
    const [state, status, built] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, adapterSync_js_1.readWorkspaceStatus)(workspaceRoot),
        (0, store_js_1.readProjectBuiltState)(workspaceRoot),
    ]);
    return { state, status, built_state: built };
}
async function retrieveIntentGraph(workspaceRoot) {
    return (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot);
}
async function retrieveDecisionBundle(workspaceRoot) {
    const [decision, graph, log] = await Promise.all([
        (0, governanceArtifacts_js_1.readGovernanceDecision)(workspaceRoot),
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot),
        (0, decisionLog_js_1.readDecisionLog)(workspaceRoot),
    ]);
    return { decision, decision_graph: graph, decision_log: log };
}
async function retrieveTimeline(workspaceRoot) {
    return (0, projectTimeline_js_1.readProjectEvolutionTimeline)(workspaceRoot);
}
async function retrieveGraph(workspaceRoot) {
    return (0, store_js_2.readProjectGraph)(workspaceRoot);
}
async function retrieveConfidence(workspaceRoot, entityId) {
    const index = await (0, confidenceIndex_js_1.readConfidenceIndex)(workspaceRoot);
    return { index, entities: index ? (0, confidenceIndex_js_1.queryConfidenceIndex)(index, entityId) : [] };
}
async function retrieveImpact(workspaceRoot, entityId) {
    const graph = await (0, impactGraph_js_1.readImpactGraph)(workspaceRoot);
    return { graph, entries: graph ? (0, impactGraph_js_1.queryImpactGraph)(graph, entityId) : [] };
}
async function retrieveWhy(workspaceRoot) {
    return (0, whyLayer_js_1.readWhyLayer)(workspaceRoot);
}
async function retrieveHealth(workspaceRoot) {
    let health = await (0, projectIntelligenceHealth_js_1.readProjectIntelligenceHealth)(workspaceRoot);
    if (!health) {
        health = await (0, projectIntelligenceHealth_js_1.deriveProjectIntelligenceHealth)(workspaceRoot).catch(() => null);
    }
    return health;
}
async function retrieveEvolution(workspaceRoot, anchor) {
    const graph = await (0, evolutionGraph_js_1.readEvolutionGraph)(workspaceRoot);
    return { graph, chains: graph ? (0, evolutionGraph_js_1.queryEvolutionGraph)(graph, anchor) : [] };
}
async function retrieveProvenance(workspaceRoot, anchor) {
    const chain = await (0, provenanceChain_js_1.readProvenanceChain)(workspaceRoot);
    return { chain, entries: chain ? (0, provenanceChain_js_1.queryProvenanceChain)(chain, anchor) : [] };
}
async function retrieveHandoff(workspaceRoot) {
    return (0, store_js_3.readHandoffArtifact)(workspaceRoot);
}
