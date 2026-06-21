import { decisionLogPath } from '../paths.js';
import type { DecisionProvenanceNode } from '../types.js';
import { readJsonFile, writeJsonFile } from '../dimensions/io.js';

export const DECISION_LOG_SCHEMA = 'decision_log.v1' as const;

export interface DecisionLogEntry {
  decision_id: string;
  intent_id: string;
  selected: string;
  reason: string;
  impact: string[];
  created_at: string;
}

export interface DecisionLogArtifact {
  schema: typeof DECISION_LOG_SCHEMA;
  updated_at: string;
  entries: DecisionLogEntry[];
}

export async function readDecisionLog(workspaceRoot: string): Promise<DecisionLogArtifact | null> {
  const raw = await readJsonFile<DecisionLogArtifact>(decisionLogPath(workspaceRoot));
  if (raw?.schema === DECISION_LOG_SCHEMA && Array.isArray(raw.entries)) {
    return raw;
  }
  return null;
}

export async function appendDecisionLogEntry(
  workspaceRoot: string,
  node: DecisionProvenanceNode,
): Promise<DecisionLogArtifact> {
  const existing = (await readDecisionLog(workspaceRoot)) ?? {
    schema: DECISION_LOG_SCHEMA,
    updated_at: new Date().toISOString(),
    entries: [],
  };

  const entry: DecisionLogEntry = {
    decision_id: node.decision_id,
    intent_id: node.linked_intent,
    selected: node.selected,
    reason: node.reason,
    impact: node.impact_scope,
    created_at: node.timestamp,
  };

  const entries = [
    ...existing.entries.filter((e) => e.decision_id !== entry.decision_id),
    entry,
  ].slice(-128);

  const artifact: DecisionLogArtifact = {
    schema: DECISION_LOG_SCHEMA,
    updated_at: new Date().toISOString(),
    entries,
  };

  await writeJsonFile(decisionLogPath(workspaceRoot), artifact);
  return artifact;
}
