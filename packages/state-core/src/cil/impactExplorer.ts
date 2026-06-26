import { readImpactGraph, queryImpactGraph } from '../intelligence/dimensions/impactGraph.js';
import { readProjectGraph } from '../understanding/store.js';
import type { BlastRadiusResult } from './types.js';

export async function getBlastRadius(
  workspaceRoot: string,
  node: string,
): Promise<BlastRadiusResult> {
  const needle = node.toLowerCase();
  const [impactGraph, projectGraph] = await Promise.all([
    readImpactGraph(workspaceRoot),
    readProjectGraph(workspaceRoot),
  ]);

  const entries = impactGraph ? queryImpactGraph(impactGraph, node) : [];
  const latest = entries[0];
  const affected = new Set<string>();

  for (const entry of entries) {
    for (const n of entry.impacted_nodes ?? []) {
      const mod = typeof n === 'string' ? n : (n as { module?: string }).module;
      if (mod) {
        affected.add(mod);
      }
    }
  }

  if (projectGraph?.edges?.length) {
    const queue = [needle];
    const visited = new Set<string>();
    while (queue.length) {
      const cur = queue.shift()!;
      if (visited.has(cur)) {
        continue;
      }
      visited.add(cur);
      for (const edge of projectGraph.edges) {
        const from = edge.from?.toLowerCase() ?? '';
        const to = edge.to?.toLowerCase() ?? '';
        if (from.includes(cur) || cur.includes(from)) {
          affected.add(edge.to);
          queue.push(to);
        }
        if (to.includes(cur) || cur.includes(to)) {
          affected.add(edge.from);
          queue.push(from);
        }
      }
    }
  }

  const affectedList = [...affected].filter((a) => a && !a.toLowerCase().includes(needle)).slice(0, 16);
  const radius = latest?.blast_radius ?? latest?.impact_radius ?? affectedList.length;
  const criticality: BlastRadiusResult['criticality'] =
    radius >= 8 ? 'high' : radius >= 3 ? 'medium' : 'low';

  const chain = [node, ...affectedList.slice(0, 6)];
  const formatted = [
    `Blast Radius: ${node}`,
    '',
    ...chain.flatMap((n, i) => (i === 0 ? [n] : ['  ↓ affects', n])),
    '',
    `Radius: ${typeof radius === 'number' ? radius.toFixed(2) : affectedList.length}`,
    `Criticality: ${criticality}`,
  ];

  if (affectedList.length === 0) {
    formatted.push('', 'No downstream impact recorded yet.');
  }

  return {
    node,
    blast_radius: typeof radius === 'number' ? radius : affectedList.length,
    criticality,
    affected: affectedList,
    chain,
    formatted,
  };
}

export async function exploreImpact(
  workspaceRoot: string,
  node?: string,
): Promise<{ formatted: string[]; result?: BlastRadiusResult }> {
  if (!node?.trim()) {
    return {
      formatted: ['Impact Explorer', '', 'Usage: contorium impact <module-or-file>'],
    };
  }
  const result = await getBlastRadius(workspaceRoot, node.trim());
  return { formatted: ['Impact Explorer', '', ...result.formatted], result };
}
