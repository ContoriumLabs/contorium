import type { AdapterKind, StateEngineMode } from '../types.js';
import {
  intelligenceRepositoryStatePath,
  intelligenceSnapshotPath,
  REPOSITORY_RUNTIME_VERSION,
  ARTIFACT_SCHEMA_VERSION,
} from './paths.js';
import { migrateProjectIntelligenceLayout } from './migration/artifactMigration.js';
import { validateProjectIntelligenceArtifacts } from './schema/schemaValidation.js';
import { deriveProjectIntelligenceHealth } from './health/projectIntelligenceHealth.js';
import { syncProjectIntelligenceDimensions } from './dimensions/syncProjectIntelligenceDimensions.js';
import { readImpactGraph } from './dimensions/impactGraph.js';
import { readProjectEvolutionTimeline } from './dimensions/projectTimeline.js';
import { readConfidenceIndex } from './dimensions/confidenceIndex.js';
import { readProvenanceChain } from './systems/provenanceChain.js';
import { readEvolutionGraph } from './systems/evolutionGraph.js';
import { readProjectIdentity } from './projectIdentity.js';
import type { ProjectIdentity, ProjectIntelligenceRepositoryState, ProjectIntelligenceSnapshot } from './types.js';
import { PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA } from './types.js';
import { writeJsonFile } from './dimensions/io.js';

/**
 * Project Intelligence Repository sync v1.1.3
 * Capture · Structure · Preserve — descriptive records only.
 */
export async function syncProjectIntelligenceRepository(
  workspaceRoot: string,
  writer: AdapterKind,
  mode: StateEngineMode = 'merged',
  prevIdentity: ProjectIdentity | null = null,
): Promise<{ repository: ProjectIntelligenceRepositoryState; snapshot: ProjectIntelligenceSnapshot }> {
  await migrateProjectIntelligenceLayout(workspaceRoot).catch(() => undefined);
  await syncProjectIntelligenceDimensions(workspaceRoot, writer, mode, prevIdentity);

  const [timeline, impact, confidence, provenance, evolution, identity, health] = await Promise.all([
    readProjectEvolutionTimeline(workspaceRoot),
    readImpactGraph(workspaceRoot),
    readConfidenceIndex(workspaceRoot),
    readProvenanceChain(workspaceRoot),
    readEvolutionGraph(workspaceRoot),
    readProjectIdentity(workspaceRoot),
    deriveProjectIntelligenceHealth(workspaceRoot),
  ]);

  await validateProjectIntelligenceArtifacts(workspaceRoot).catch(() => undefined);

  const latestImpact = impact?.entries[impact.entries.length - 1];
  const projectConfidence = confidence?.entities.find((e) => e.entity_id === 'project');
  const radius = latestImpact?.impact_radius ?? latestImpact?.blast_radius;

  const repository: ProjectIntelligenceRepositoryState = {
    schema: PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA,
    updated_at: new Date().toISOString(),
    last_signal_source: writer,
    repository_version: REPOSITORY_RUNTIME_VERSION,
    schema_version: ARTIFACT_SCHEMA_VERSION,
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

  const snapshot: ProjectIntelligenceSnapshot = {
    schema: PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA,
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
    writeJsonFile(intelligenceRepositoryStatePath(workspaceRoot), repository),
    writeJsonFile(intelligenceSnapshotPath(workspaceRoot), snapshot),
  ]);

  return { repository, snapshot };
}

/** @deprecated use syncProjectIntelligenceRepository */
export const runCognitiveEngine = syncProjectIntelligenceRepository;

function buildRepositorySummary(
  repository: ProjectIntelligenceRepositoryState,
  blastRadius?: number,
  category?: string,
  health?: ProjectIntelligenceRepositoryState['health'],
): string {
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
