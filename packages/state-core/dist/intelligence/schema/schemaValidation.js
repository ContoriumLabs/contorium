"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProjectIntelligenceArtifacts = validateProjectIntelligenceArtifacts;
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
const decisionProvenance_js_1 = require("../decisionProvenance.js");
const intentVNext_js_1 = require("../intentVNext.js");
const whyLayer_js_1 = require("../whyLayer.js");
const impactGraph_js_1 = require("../dimensions/impactGraph.js");
const confidenceIndex_js_1 = require("../dimensions/confidenceIndex.js");
const projectTimeline_js_1 = require("../dimensions/projectTimeline.js");
const provenanceChain_js_1 = require("../systems/provenanceChain.js");
const evolutionGraph_js_1 = require("../systems/evolutionGraph.js");
const types_js_1 = require("../types.js");
const paths_js_1 = require("../paths.js");
const io_js_1 = require("../dimensions/io.js");
function issue(artifact, message, field) {
    return { artifact, message, field };
}
/** v1.1 — validate core intelligence artifact schemas (descriptive checks only). */
async function validateProjectIntelligenceArtifacts(workspaceRoot) {
    const issues = [];
    const state = await (0, bootstrapState_js_1.readStateJson)(workspaceRoot);
    if (!state?.sessionId) {
        issues.push(issue('state.json', 'missing sessionId'));
    }
    const intent = await (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot);
    for (const node of intent?.nodes ?? []) {
        if (!node.intent_id || !node.name) {
            issues.push(issue('intent/intent_graph.json', 'intent node missing intent_id or name', node.intent_id));
        }
    }
    const decisionGraph = await (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot);
    for (const node of decisionGraph?.nodes ?? []) {
        if (!node.decision_id || !node.selected) {
            issues.push(issue('decision/decision_graph.json', 'decision node incomplete', node.decision_id));
        }
    }
    const why = await (0, whyLayer_js_1.readWhyLayer)(workspaceRoot);
    for (const f of why?.features ?? []) {
        if (!f.feature || !f.why) {
            issues.push(issue('intent/why.json', 'why entry missing feature or why', f.feature));
        }
    }
    const timeline = await (0, projectTimeline_js_1.readProjectEvolutionTimeline)(workspaceRoot);
    for (const evt of timeline?.events ?? []) {
        if (!evt.event_id || !evt.event_type) {
            issues.push(issue('timeline/project_timeline.json', 'timeline event incomplete', evt.event_id));
        }
    }
    const impact = await (0, impactGraph_js_1.readImpactGraph)(workspaceRoot);
    for (const entry of impact?.entries ?? []) {
        if (entry.impact_radius === undefined && entry.blast_radius === undefined) {
            issues.push(issue('graph/impact_graph.json', 'impact entry missing impact_radius', entry.source_entity));
        }
    }
    const confidence = await (0, confidenceIndex_js_1.readConfidenceIndex)(workspaceRoot);
    for (const e of confidence?.entities ?? []) {
        if (e.confidence_score < 0 || e.confidence_score > 1) {
            issues.push(issue('confidence/confidence_index.json', 'confidence_score out of range 0–1', e.entity_id));
        }
    }
    if (!(await (0, provenanceChain_js_1.readProvenanceChain)(workspaceRoot))) {
        issues.push(issue('provenance/provenance_chain.json', 'not yet derived — run sync'));
    }
    if (!(await (0, evolutionGraph_js_1.readEvolutionGraph)(workspaceRoot))) {
        issues.push(issue('evolution/evolution_graph.json', 'not yet derived — run sync'));
    }
    const report = {
        schema: types_js_1.PROJECT_INTELLIGENCE_VALIDATION_SCHEMA,
        updated_at: new Date().toISOString(),
        valid: issues.length === 0,
        issues,
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.intelligenceValidationPath)(workspaceRoot), report);
    return report;
}
