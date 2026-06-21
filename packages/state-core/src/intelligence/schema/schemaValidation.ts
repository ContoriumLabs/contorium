import { readStateJson } from '../../bootstrap/bootstrapState.js';
import { readDecisionProvenanceGraph } from '../decisionProvenance.js';
import { readIntentGraphVNext } from '../intentVNext.js';
import { readWhyLayer } from '../whyLayer.js';
import { readImpactGraph } from '../dimensions/impactGraph.js';
import { readConfidenceIndex } from '../dimensions/confidenceIndex.js';
import { readProjectEvolutionTimeline } from '../dimensions/projectTimeline.js';
import { readProvenanceChain } from '../systems/provenanceChain.js';
import { readEvolutionGraph } from '../systems/evolutionGraph.js';
import type { ProjectIntelligenceValidation, SchemaValidationIssue } from '../types.js';
import { PROJECT_INTELLIGENCE_VALIDATION_SCHEMA } from '../types.js';
import { intelligenceValidationPath } from '../paths.js';
import { writeJsonFile } from '../dimensions/io.js';

function issue(artifact: string, message: string, field?: string): SchemaValidationIssue {
  return { artifact, message, field };
}

/** v1.1 — validate core intelligence artifact schemas (descriptive checks only). */
export async function validateProjectIntelligenceArtifacts(
  workspaceRoot: string,
): Promise<ProjectIntelligenceValidation> {
  const issues: SchemaValidationIssue[] = [];

  const state = await readStateJson(workspaceRoot);
  if (!state?.sessionId) {
    issues.push(issue('state.json', 'missing sessionId'));
  }

  const intent = await readIntentGraphVNext(workspaceRoot);
  for (const node of intent?.nodes ?? []) {
    if (!node.intent_id || !node.name) {
      issues.push(issue('intent/intent_graph.json', 'intent node missing intent_id or name', node.intent_id));
    }
  }

  const decisionGraph = await readDecisionProvenanceGraph(workspaceRoot);
  for (const node of decisionGraph?.nodes ?? []) {
    if (!node.decision_id || !node.selected) {
      issues.push(issue('decision/decision_graph.json', 'decision node incomplete', node.decision_id));
    }
  }

  const why = await readWhyLayer(workspaceRoot);
  for (const f of why?.features ?? []) {
    if (!f.feature || !f.why) {
      issues.push(issue('intent/why.json', 'why entry missing feature or why', f.feature));
    }
  }

  const timeline = await readProjectEvolutionTimeline(workspaceRoot);
  for (const evt of timeline?.events ?? []) {
    if (!evt.event_id || !evt.event_type) {
      issues.push(issue('timeline/project_timeline.json', 'timeline event incomplete', evt.event_id));
    }
  }

  const impact = await readImpactGraph(workspaceRoot);
  for (const entry of impact?.entries ?? []) {
    if (entry.impact_radius === undefined && entry.blast_radius === undefined) {
      issues.push(issue('graph/impact_graph.json', 'impact entry missing impact_radius', entry.source_entity));
    }
  }

  const confidence = await readConfidenceIndex(workspaceRoot);
  for (const e of confidence?.entities ?? []) {
    if (e.confidence_score < 0 || e.confidence_score > 1) {
      issues.push(issue('confidence/confidence_index.json', 'confidence_score out of range 0–1', e.entity_id));
    }
  }

  if (!(await readProvenanceChain(workspaceRoot))) {
    issues.push(issue('provenance/provenance_chain.json', 'not yet derived — run sync'));
  }

  if (!(await readEvolutionGraph(workspaceRoot))) {
    issues.push(issue('evolution/evolution_graph.json', 'not yet derived — run sync'));
  }

  const report: ProjectIntelligenceValidation = {
    schema: PROJECT_INTELLIGENCE_VALIDATION_SCHEMA,
    updated_at: new Date().toISOString(),
    valid: issues.length === 0,
    issues,
  };

  await writeJsonFile(intelligenceValidationPath(workspaceRoot), report);
  return report;
}
