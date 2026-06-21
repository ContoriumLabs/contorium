"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCognitiveEngine = void 0;
exports.syncProjectIntelligenceRepository = syncProjectIntelligenceRepository;
const paths_js_1 = require("./paths.js");
const artifactMigration_js_1 = require("./migration/artifactMigration.js");
const schemaValidation_js_1 = require("./schema/schemaValidation.js");
const projectIntelligenceHealth_js_1 = require("./health/projectIntelligenceHealth.js");
const syncProjectIntelligenceDimensions_js_1 = require("./dimensions/syncProjectIntelligenceDimensions.js");
const impactGraph_js_1 = require("./dimensions/impactGraph.js");
const projectTimeline_js_1 = require("./dimensions/projectTimeline.js");
const confidenceIndex_js_1 = require("./dimensions/confidenceIndex.js");
const provenanceChain_js_1 = require("./systems/provenanceChain.js");
const evolutionGraph_js_1 = require("./systems/evolutionGraph.js");
const projectIdentity_js_1 = require("./projectIdentity.js");
const types_js_1 = require("./types.js");
const io_js_1 = require("./dimensions/io.js");
/**
 * Project Intelligence Repository sync v1.1.3
 * Capture · Structure · Preserve — descriptive records only.
 */
async function syncProjectIntelligenceRepository(workspaceRoot, writer, mode = 'merged', prevIdentity = null) {
    await (0, artifactMigration_js_1.migrateProjectIntelligenceLayout)(workspaceRoot).catch(() => undefined);
    await (0, syncProjectIntelligenceDimensions_js_1.syncProjectIntelligenceDimensions)(workspaceRoot, writer, mode, prevIdentity);
    const [timeline, impact, confidence, provenance, evolution, identity, health] = await Promise.all([
        (0, projectTimeline_js_1.readProjectEvolutionTimeline)(workspaceRoot),
        (0, impactGraph_js_1.readImpactGraph)(workspaceRoot),
        (0, confidenceIndex_js_1.readConfidenceIndex)(workspaceRoot),
        (0, provenanceChain_js_1.readProvenanceChain)(workspaceRoot),
        (0, evolutionGraph_js_1.readEvolutionGraph)(workspaceRoot),
        (0, projectIdentity_js_1.readProjectIdentity)(workspaceRoot),
        (0, projectIntelligenceHealth_js_1.deriveProjectIntelligenceHealth)(workspaceRoot),
    ]);
    await (0, schemaValidation_js_1.validateProjectIntelligenceArtifacts)(workspaceRoot).catch(() => undefined);
    const latestImpact = impact?.entries[impact.entries.length - 1];
    const projectConfidence = confidence?.entities.find((e) => e.entity_id === 'project');
    const radius = latestImpact?.impact_radius ?? latestImpact?.blast_radius;
    const repository = {
        schema: types_js_1.PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA,
        updated_at: new Date().toISOString(),
        last_signal_source: writer,
        repository_version: paths_js_1.REPOSITORY_RUNTIME_VERSION,
        schema_version: paths_js_1.ARTIFACT_SCHEMA_VERSION,
        pipeline_version: 2,
        dimensions: {
            timeline_events: timeline?.events.length ?? 0,
            impact_entries: impact?.entries.length ?? 0,
            confidence_entities: confidence?.entities.length ?? 0,
            provenance_entries: provenance?.entries.length ?? 0,
            evolution_chains: evolution?.chains.length ?? 0,
        },
        health: health.metrics,
    };
    const snapshot = {
        schema: types_js_1.PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA,
        updated_at: new Date().toISOString(),
        layers: {
            state_hash: identity?.current_state_hash,
            active_intents: identity?.active_intents.length ?? 0,
            active_decisions: identity?.active_decisions.length ?? 0,
            timeline_events: repository.dimensions.timeline_events,
            impact_blast_radius: radius,
            confidence_score: projectConfidence?.confidence_score,
        },
        summary: buildRepositorySummary(repository, radius, projectConfidence?.category, health.metrics),
    };
    await Promise.all([
        (0, io_js_1.writeJsonFile)((0, paths_js_1.intelligenceRepositoryStatePath)(workspaceRoot), repository),
        (0, io_js_1.writeJsonFile)((0, paths_js_1.intelligenceSnapshotPath)(workspaceRoot), snapshot),
    ]);
    return { repository, snapshot };
}
/** @deprecated use syncProjectIntelligenceRepository */
exports.runCognitiveEngine = syncProjectIntelligenceRepository;
function buildRepositorySummary(repository, blastRadius, category, health) {
    const parts = [
        `v${repository.repository_version}`,
        `timeline:${repository.dimensions.timeline_events}`,
        `impact:${repository.dimensions.impact_entries}`,
        `confidence:${repository.dimensions.confidence_entities}`,
    ];
    if (health) {
        parts.push(`health:${health.health_score}(${health.health_category})`);
        parts.push(`coverage:${health.knowledge_coverage}`);
    }
    if (blastRadius !== undefined) {
        parts.push(`radius:${blastRadius}`);
    }
    if (category) {
        parts.push(`trust:${category}`);
    }
    return parts.join(' · ');
}
