import { readDecisionProvenanceGraph } from '../decisionProvenance.js';
import { readIntentGraphVNext } from '../intentVNext.js';
import { readWhyLayer } from '../whyLayer.js';
import { readImpactGraph } from '../dimensions/impactGraph.js';
import { readConfidenceIndex } from '../dimensions/confidenceIndex.js';
import { readProjectEvolutionTimeline } from '../dimensions/projectTimeline.js';
import { readProvenanceChain } from '../systems/provenanceChain.js';
import { readEvolutionGraph } from '../systems/evolutionGraph.js';
import { readStateJson } from '../../bootstrap/bootstrapState.js';
import type { ProjectIntelligenceHealth, ProjectIntelligenceHealthMetrics } from '../types.js';
import { PROJECT_INTELLIGENCE_HEALTH_SCHEMA } from '../types.js';
import { intelligenceHealthPath } from '../paths.js';
import { readJsonFile, writeJsonFile } from '../dimensions/io.js';
import { classifyHealthScore, computeHealthScore } from '../metrics/health.js';
import { deriveKnowledgeCoverage } from '../metrics/coverage.js';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

/** v1.2+ — intelligence asset completeness & weighted health score */
export async function deriveProjectIntelligenceHealth(
  workspaceRoot: string,
): Promise<ProjectIntelligenceHealth> {
  const [
    state,
    intent,
    decisionGraph,
    why,
    timeline,
    impact,
    confidence,
    provenance,
    evolution,
    coverage,
  ] = await Promise.all([
    readStateJson(workspaceRoot),
    readIntentGraphVNext(workspaceRoot),
    readDecisionProvenanceGraph(workspaceRoot),
    readWhyLayer(workspaceRoot),
    readProjectEvolutionTimeline(workspaceRoot),
    readImpactGraph(workspaceRoot),
    readConfidenceIndex(workspaceRoot),
    readProvenanceChain(workspaceRoot),
    readEvolutionGraph(workspaceRoot),
    deriveKnowledgeCoverage(workspaceRoot),
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
  const intelligence_completeness = clamp01(
    layerFlags.filter(Boolean).length / layerFlags.length,
  );

  const decisions = decisionGraph?.nodes ?? [];
  const withIntent = decisions.filter((d) => d.linked_intent?.trim()).length;
  const decision_coverage = decisions.length ? clamp01(withIntent / decisions.length) : 0;

  const intents = intent?.nodes ?? [];
  const linked = intents.filter((i) => (i.linked_decisions?.length ?? 0) > 0).length;
  const intent_linkage = intents.length ? clamp01(linked / intents.length) : 0;

  const provEntries = provenance?.entries ?? [];
  const fullChains = provEntries.filter((e) => e.chain.length >= 3).length;
  const provenance_coverage = provEntries.length ? clamp01(fullChains / provEntries.length) : 0;

  const base: Omit<ProjectIntelligenceHealthMetrics, 'health_score' | 'health_category'> = {
    intelligence_completeness,
    decision_coverage,
    intent_linkage,
    provenance_coverage,
    knowledge_coverage: coverage.knowledge_coverage,
  };

  const health_score = computeHealthScore(base);
  const health_category = classifyHealthScore(health_score);

  const metrics: ProjectIntelligenceHealthMetrics = {
    ...base,
    health_score,
    health_category,
  };

  const health: ProjectIntelligenceHealth = {
    schema: PROJECT_INTELLIGENCE_HEALTH_SCHEMA,
    updated_at: new Date().toISOString(),
    metrics,
    coverage_detail: {
      covered_modules: coverage.covered_modules.slice(0, 24),
      total_modules: coverage.total_modules.slice(0, 24),
    },
  };

  await writeJsonFile(intelligenceHealthPath(workspaceRoot), health);
  return health;
}

export async function readProjectIntelligenceHealth(
  workspaceRoot: string,
): Promise<ProjectIntelligenceHealth | null> {
  const raw = await readJsonFile<ProjectIntelligenceHealth>(intelligenceHealthPath(workspaceRoot));
  if (raw?.schema === PROJECT_INTELLIGENCE_HEALTH_SCHEMA && raw.metrics) {
    return raw;
  }
  return null;
}
