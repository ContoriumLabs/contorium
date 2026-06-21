import {
  confidenceIndexPath,
  legacyStabilityIndexPath,
} from '../paths.js';
import type {
  CognitionConfidenceMeta,
  ConfidenceCategory,
  ConfidenceIndexArtifact,
  ConfidenceIndexEntry,
  ConfidenceSignalSources,
} from '../types.js';
import { CONFIDENCE_INDEX_SCHEMA } from '../types.js';
import { readJsonFile, writeJsonFile } from './io.js';

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function classifyConfidence(score: number): ConfidenceCategory {
  if (score >= 0.8) {
    return 'stable';
  }
  if (score >= 0.5) {
    return 'evolving';
  }
  return 'experimental';
}

/** Descriptive confidence scoring — not prescriptive recommendations. */
export function deriveConfidenceFromSignals(signals: ConfidenceSignalSources): {
  entry: Omit<ConfidenceIndexEntry, 'entity_id' | 'updated_at'>;
  meta: CognitionConfidenceMeta;
} {
  const changeNorm = sigmoid(signals.change_frequency - 2) * 0.3;
  const decisionVol = Math.min(1, signals.decision_volatility / 5) * 0.35;
  const intentInst = Math.min(1, signals.intent_changes / 4) * 0.35;
  const uncertainty = changeNorm + decisionVol + intentInst;
  const confidence_score = Math.max(0, Math.min(1, Math.round((1 - uncertainty) * 100) / 100));
  const category = classifyConfidence(confidence_score);
  const freshness: CognitionConfidenceMeta['freshness'] =
    signals.change_frequency > 1 || signals.intent_changes > 0 ? 'recent' : 'historical';

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

export async function readConfidenceIndex(
  workspaceRoot: string,
): Promise<ConfidenceIndexArtifact | null> {
  let raw = await readJsonFile<ConfidenceIndexArtifact>(confidenceIndexPath(workspaceRoot));
  if (!raw) {
    raw = await readJsonFile<ConfidenceIndexArtifact>(legacyStabilityIndexPath(workspaceRoot));
  }
  if (raw?.schema === CONFIDENCE_INDEX_SCHEMA && Array.isArray(raw.entities)) {
    return raw;
  }
  // Legacy stability_index.v1 migration on read
  const legacy = await readJsonFile<{
    schema: string;
    updated_at: string;
    entities: Array<Record<string, unknown>>;
  }>(legacyStabilityIndexPath(workspaceRoot));
  if (legacy?.schema === 'stability_index.v1' && Array.isArray(legacy.entities)) {
    return {
      schema: CONFIDENCE_INDEX_SCHEMA,
      updated_at: legacy.updated_at,
      entities: legacy.entities.map((e) => ({
        entity_id: String(e.entity_id ?? ''),
        confidence_score: Number(e.stability_score ?? e.confidence ?? 0.5),
        category: (e.stability_state ?? e.category ?? 'evolving') as ConfidenceCategory,
        freshness: (e.freshness ?? 'historical') as CognitionConfidenceMeta['freshness'],
        signal_sources: {
          change_frequency: Number((e.signal_sources as Record<string, number>)?.git_frequency ?? 0),
          decision_volatility: Number((e.signal_sources as Record<string, number>)?.decision_rewrites ?? 0),
          intent_changes: Number((e.signal_sources as Record<string, number>)?.intent_changes ?? 0),
        },
        updated_at: String(e.updated_at ?? legacy.updated_at),
      })),
    };
  }
  return null;
}

export function queryConfidenceIndex(
  index: ConfidenceIndexArtifact,
  entityId?: string,
): ConfidenceIndexEntry[] {
  if (!entityId) {
    return [...index.entities];
  }
  const needle = entityId.toLowerCase();
  return index.entities.filter((e) => e.entity_id.toLowerCase().includes(needle));
}

export async function writeConfidenceIndex(
  workspaceRoot: string,
  entities: ConfidenceIndexEntry[],
): Promise<ConfidenceIndexArtifact> {
  const artifact: ConfidenceIndexArtifact = {
    schema: CONFIDENCE_INDEX_SCHEMA,
    updated_at: new Date().toISOString(),
    entities: entities.slice(0, 64),
  };
  await writeJsonFile(confidenceIndexPath(workspaceRoot), artifact);
  return artifact;
}
