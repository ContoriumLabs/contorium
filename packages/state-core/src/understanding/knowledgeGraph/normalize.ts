import {
  KNOWLEDGE_ENGINE_VERSION,
  KNOWLEDGE_SCHEMA_VERSION,
  type GraphMetadata,
  type KnowledgeEdge,
  type IntentFunctionMapping,
  type LegacyProjectKnowledgeGraph,
  type ProjectKnowledgeGraph,
} from './types.js';
import { getContoriumPackageVersion } from '../../version.js';
import { buildKnowledgeSnapshot } from './snapshotBuilder.js';
import { buildHotspots } from './hotspotBuilder.js';
import { CLOSURE_VERSION } from './closureConstants.js';
import { splitMappingsByCanonicalThreshold, filterCanonicalEdges } from './confidence.js';

function workspaceIdFromRoot(root: string): string {
  let h = 0;
  const s = root.replace(/\\/g, '/');
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).slice(0, 12);
}

export function buildGraphMetadata(args: {
  workspaceRoot: string;
  now: number;
  sourceVersion?: string;
  rebuildTrigger?: string;
  lastCommitHash?: string;
}): GraphMetadata {
  return {
    version: KNOWLEDGE_ENGINE_VERSION,
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    closureVersion: CLOSURE_VERSION,
    generatedAt: args.now,
    workspaceId: workspaceIdFromRoot(args.workspaceRoot),
    graphBuildId: `graph_${args.now.toString(36)}`,
    sourceVersion: args.sourceVersion ?? getContoriumPackageVersion(),
    rebuildTrigger: args.rebuildTrigger,
    lastCommitHash: args.lastCommitHash,
  };
}

function withEdgeConfidence(edges: KnowledgeEdge[]): KnowledgeEdge[] {
  return edges.map((e) => ({
    ...e,
    confidence: e.confidence ?? (e.type === 'supports_intent' ? e.weight : 0.85),
  }));
}

function withMappingConfidence(mappings: IntentFunctionMapping[]): IntentFunctionMapping[] {
  return mappings.map((m) => ({
    ...m,
    confidence: m.confidence ?? m.score,
  }));
}

/** schemaVersion switch — upgrade legacy graphs on read. */
export function normalizeKnowledgeGraph(
  raw: unknown,
  workspaceRoot?: string,
): ProjectKnowledgeGraph | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const r = raw as Record<string, unknown>;

  if (r.meta && typeof r.meta === 'object') {
    const kg = raw as ProjectKnowledgeGraph;
    const schema = (kg.meta.schemaVersion ?? KNOWLEDGE_SCHEMA_VERSION).toString();
    if (schema !== KNOWLEDGE_SCHEMA_VERSION) {
      return upgradeSchema(kg, workspaceRoot);
    }
    return {
      ...kg,
      edges: filterCanonicalEdges(withEdgeConfidence(kg.edges ?? [])),
      intentMappings: withMappingConfidence(kg.intentMappings ?? []),
      inferenceMappings: kg.inferenceMappings ?? [],
      hotspots: (kg.hotspots ?? []).map((h) => ({
        ...h,
        lifecycle: h.lifecycle ?? 'active',
      })),
      snapshot:
        kg.snapshot ??
        buildKnowledgeSnapshot({
          nodes: kg.nodes,
          edges: kg.edges,
          intentMappings: kg.intentMappings,
          hotspots: kg.hotspots ?? [],
          nextActions: [],
          now: kg.meta.generatedAt,
        }),
    };
  }

  if (r.version === 1) {
    return migrateLegacyV1(raw as LegacyProjectKnowledgeGraph, workspaceRoot);
  }

  return undefined;
}

function upgradeSchema(kg: ProjectKnowledgeGraph, workspaceRoot?: string): ProjectKnowledgeGraph {
  return normalizeKnowledgeGraph(
    {
      ...kg,
      meta: { ...kg.meta, schemaVersion: KNOWLEDGE_SCHEMA_VERSION },
    },
    workspaceRoot,
  )!;
}

function migrateLegacyV1(
  legacy: LegacyProjectKnowledgeGraph,
  workspaceRoot?: string,
): ProjectKnowledgeGraph {
  const edges: KnowledgeEdge[] = (legacy.edges ?? []).map((e) => ({
    source: e.source,
    target: e.target,
    type: e.type,
    weight: e.weight,
    confidence: e.confidence ?? (e.type === 'supports_intent' ? e.weight : 0.85),
  }));
  const intentMappings: IntentFunctionMapping[] = (legacy.intentMappings ?? []).map((m) => ({
    intentId: m.intentId,
    functionId: m.functionId,
    score: m.score,
    confidence: m.confidence ?? m.score,
    signals: m.signals,
  }));
  const { canonical, inference } = splitMappingsByCanonicalThreshold(intentMappings);
  const partial: Omit<ProjectKnowledgeGraph, 'meta' | 'hotspots' | 'snapshot'> = {
    nodes: legacy.nodes ?? [],
    edges: filterCanonicalEdges(edges),
    intentMappings: canonical,
    inferenceMappings: inference,
    reasonTraces: legacy.reasonTraces ?? [],
    intentTrees: legacy.intentTrees ?? [],
  };
  const hotspots = buildHotspots({
    nodes: partial.nodes,
    edges: partial.edges,
    intentMappings: partial.intentMappings,
    editCounts: new Map(),
    gitFrequency: new Map(),
    now: legacy.generatedAt,
  });
  const snapshot = buildKnowledgeSnapshot({
    nodes: partial.nodes,
    edges: partial.edges,
    intentMappings: partial.intentMappings,
    hotspots,
    nextActions: [],
    now: legacy.generatedAt,
  });
  return {
    meta: buildGraphMetadata({
      workspaceRoot: workspaceRoot ?? 'unknown',
      now: legacy.generatedAt,
    }),
    ...partial,
    hotspots,
    snapshot,
  };
}
