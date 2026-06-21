import { impactGraphPath } from '../paths.js';
import type { ImpactGraphArtifact, ImpactGraphEntry, ImpactedNode } from '../types.js';
import { IMPACT_GRAPH_SCHEMA } from '../types.js';
import { readJsonFile, writeJsonFile } from './io.js';

export async function readImpactGraph(workspaceRoot: string): Promise<ImpactGraphArtifact | null> {
  const raw = await readJsonFile<ImpactGraphArtifact>(impactGraphPath(workspaceRoot));
  if (raw?.schema === IMPACT_GRAPH_SCHEMA && Array.isArray(raw.entries)) {
    return raw;
  }
  return null;
}

export function queryImpactGraph(
  graph: ImpactGraphArtifact,
  entityId?: string,
): ImpactGraphEntry[] {
  if (!entityId) {
    return [...graph.entries].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }
  const needle = entityId.toLowerCase();
  return graph.entries.filter(
    (e) =>
      e.source_entity.toLowerCase().includes(needle) ||
      e.impacted_nodes.some((n) => n.module.toLowerCase().includes(needle)),
  );
}

function decayWeight(distance: number): number {
  return Math.max(0.15, 1 - distance * 0.22);
}

/** BFS propagation over module adjacency derived from affected paths. */
export function deriveImpactPropagation(args: {
  source_entity: string;
  change_type: string;
  seed_modules: string[];
  related_modules: string[];
  risk_hint?: 'low' | 'medium' | 'high' | 'critical';
}): ImpactGraphEntry {
  const seeds = [...new Set(args.seed_modules.map((m) => m.replace(/\\/g, '/').split('/')[0] ?? m))];
  const related = [...new Set(args.related_modules.map((m) => m.replace(/\\/g, '/').split('/')[0] ?? m))];
  const allModules = [...new Set([...seeds, ...related])].filter(Boolean);

  const impacted = new Map<string, number>();
  let maxDepth = 0;
  for (const seed of seeds) {
    impacted.set(seed, 1);
    let frontier = [seed];
    for (let depth = 1; depth <= 3; depth++) {
      const next: string[] = [];
      for (const mod of frontier) {
        for (const candidate of allModules) {
          if (candidate === mod || impacted.has(candidate)) {
            continue;
          }
          if (
            candidate.includes(mod) ||
            mod.includes(candidate) ||
            related.includes(candidate)
          ) {
            const level = decayWeight(depth);
            impacted.set(candidate, Math.max(impacted.get(candidate) ?? 0, level));
            next.push(candidate);
            maxDepth = Math.max(maxDepth, depth);
          }
        }
      }
      frontier = next;
    }
  }

  const impacted_nodes: ImpactedNode[] = [...impacted.entries()]
    .map(([module, impact_level]) => ({ module, impact_level: Math.round(impact_level * 100) / 100 }))
    .sort((a, b) => b.impact_level - a.impact_level)
    .slice(0, 24);

  const totalNodes = Math.max(allModules.length, 1);
  const impact_radius = Math.min(1, impacted_nodes.length / totalNodes);

  const riskBase = args.risk_hint === 'critical' ? 0.9 : args.risk_hint === 'high' ? 0.75 : args.risk_hint === 'medium' ? 0.55 : 0.35;
  const depthFactor = Math.min(1, impacted_nodes.filter((n) => n.impact_level >= 0.6).length / 4);
  const risk_score = Math.min(1, Math.round((riskBase * 0.5 + impact_radius * 0.3 + depthFactor * 0.2) * 100) / 100);

  return {
    source_entity: args.source_entity,
    change_type: args.change_type,
    impacted_nodes,
    impact_radius: Math.round(impact_radius * 100) / 100,
    blast_radius: Math.round(impact_radius * 100) / 100,
    dependency_depth: maxDepth,
    risk_score,
    updated_at: new Date().toISOString(),
  };
}

export async function upsertImpactGraphEntry(
  workspaceRoot: string,
  entry: ImpactGraphEntry,
): Promise<ImpactGraphArtifact> {
  const existing = (await readImpactGraph(workspaceRoot)) ?? {
    schema: IMPACT_GRAPH_SCHEMA,
    updated_at: new Date().toISOString(),
    entries: [],
  };

  const entries = [
    ...existing.entries.filter((e) => e.source_entity !== entry.source_entity),
    entry,
  ].slice(-48);

  const graph: ImpactGraphArtifact = {
    schema: IMPACT_GRAPH_SCHEMA,
    updated_at: new Date().toISOString(),
    entries,
  };

  await writeJsonFile(impactGraphPath(workspaceRoot), graph);
  return graph;
}
