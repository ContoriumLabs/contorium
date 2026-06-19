import type { BootstrapStateJson } from '../types.js';
import type { HandoffArtifact, ProjectGraph } from '../understanding/types.js';
import { readHandoffArtifact, readProjectGraph } from '../understanding/store.js';
import {
  syncIdentityFocus,
} from './init.js';
import {
  writeCognitiveGraph,
  writeCognitiveIntent,
  writeCognitiveRisk,
  writeCognitiveState,
  readUserRequestOverlay,
} from './store.js';
import type { CognitiveGraph, CognitiveIntent, CognitiveRisk, ProjectCognitiveState } from './types.js';

function estimateProgress(state: BootstrapStateJson | null, handoff?: HandoffArtifact): number {
  const task = state?.currentTask?.trim();
  if (task && handoff?.next_actions?.length) {
    return 0.55;
  }
  if (handoff?.key_changes?.length) {
    return 0.4;
  }
  if (state?.recentFiles?.length) {
    return 0.25;
  }
  return 0.1;
}

function inferPhase(state: BootstrapStateJson | null, handoff?: HandoffArtifact): string {
  if (state?.currentTask?.trim()) {
    return 'active_development';
  }
  if (handoff?.impact_summary?.risk === 'high') {
    return 'risk_mitigation';
  }
  if (handoff?.key_changes?.length) {
    return 'change_integration';
  }
  return 'exploration';
}

function graphToCognitive(graph?: ProjectGraph): CognitiveGraph {
  const now = Date.now();
  if (!graph?.nodes?.length) {
    return { version: 1, generatedAt: now, nodes: [], edges: [] };
  }
  const moduleNodes = new Set<string>();
  for (const n of graph.nodes) {
    const mod = n.file.split('/')[0] ?? n.name;
    moduleNodes.add(mod);
  }
  const nodes = [...moduleNodes].slice(0, 24);
  const edges: [string, string][] = [];
  for (const e of graph.edges.slice(0, 32)) {
    const fromNode = graph.nodes.find((n) => n.id === e.from);
    const toNode = graph.nodes.find((n) => n.id === e.to);
    if (!fromNode || !toNode) {
      continue;
    }
    const fromMod = fromNode.file.split('/')[0] ?? fromNode.name;
    const toMod = toNode.file.split('/')[0] ?? toNode.name;
    if (fromMod !== toMod) {
      edges.push([fromMod, toMod]);
    }
  }
  return { version: 1, generatedAt: now, nodes, edges: edges.slice(0, 24) };
}

/**
 * Project V3.1 artifacts into `.contora/cognitive/` (derived cache, safe to regenerate).
 */
export async function syncCognitiveLayer(
  workspaceRoot: string,
  state: BootstrapStateJson | null,
): Promise<void> {
  const handoff = await readHandoffArtifact(workspaceRoot);
  const graph = await readProjectGraph(workspaceRoot);
  const userOverlay = await readUserRequestOverlay(workspaceRoot);
  const now = Date.now();

  const cognitiveState: ProjectCognitiveState = {
    version: 1,
    generatedAt: now,
    phase: userOverlay?.phase_hint ?? inferPhase(state, handoff),
    progress: estimateProgress(state, handoff),
    current_focus: userOverlay?.goal ?? handoff?.current_focus ?? state?.currentTask ?? '',
    active_tasks: (handoff?.next_actions ?? []).map((a) => `${a.action}:${a.target}`).slice(0, 8),
  };

  const intent: CognitiveIntent = {
    version: 1,
    generatedAt: now,
    goal: userOverlay?.goal ?? handoff?.goal ?? state?.currentTask ?? '',
    constraints: userOverlay?.constraints ?? [],
    success_metrics: [],
  };

  const risks: CognitiveRisk = {
    version: 1,
    generatedAt: now,
    risks: [],
  };

  if (handoff?.impact_summary) {
    risks.risks.push({
      type: 'impact_summary',
      level: handoff.impact_summary.risk,
      description: handoff.impact_summary.details.join('; ') || 'Impact from recent changes',
    });
  }
  if (handoff?.impact_summary?.affected_modules?.length) {
    risks.risks.push({
      type: 'affected_modules',
      level: handoff.impact_summary.risk,
      description: `Modules: ${handoff.impact_summary.affected_modules.slice(0, 6).join(', ')}`,
    });
  }

  await writeCognitiveState(workspaceRoot, cognitiveState);
  await writeCognitiveIntent(workspaceRoot, intent);
  await writeCognitiveRisk(workspaceRoot, risks);

  const baseGraph = graphToCognitive(graph);
  if (userOverlay?.module_hints?.length) {
    const nodes = [...new Set([...baseGraph.nodes, ...userOverlay.module_hints])].slice(0, 24);
    const edges = [...baseGraph.edges];
    const anchor = userOverlay.module_hints[0];
    if (anchor) {
      for (const hint of userOverlay.module_hints.slice(1)) {
        edges.push([anchor, hint]);
      }
    }
    await writeCognitiveGraph(workspaceRoot, {
      ...baseGraph,
      generatedAt: now,
      nodes,
      edges: edges.slice(0, 24),
    });
  } else {
    await writeCognitiveGraph(workspaceRoot, baseGraph);
  }

  if (handoff?.current_focus) {
    await syncIdentityFocus(workspaceRoot, [handoff.current_focus]);
  }
}
