import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AdrRecord, CognitiveEvent } from '../cil/types.js';
import { readAllCognitiveEvents } from '../cil/eventStore.js';
import { extractAdrAssumptions } from './assumption.js';
import { extractTechTerms } from './dependencyInventory.js';
import { decisionDependencyGraphPath } from './governanceGraphPaths.js';
import type { AssumptionGraphArtifact } from './assumptionGraph.js';
import { buildAssumptionGraph } from './assumptionGraph.js';

export const DECISION_DEPENDENCY_GRAPH_SCHEMA = 'contorium.decision_dependency_graph.v1' as const;

export interface DecisionDependencyNode {
  decision: string;
  depends_on: {
    assumptions: string[];
    modules: string[];
    dependencies: string[];
    owners: string[];
  };
}

export interface DecisionDependencyGraphArtifact {
  schema: typeof DECISION_DEPENDENCY_GRAPH_SCHEMA;
  updated_at: string;
  decisions: DecisionDependencyNode[];
}

function extractTechDependencies(text: string): string[] {
  return extractTechTerms(text);
}

function modulesForDecision(adr: AdrRecord, events: CognitiveEvent[]): string[] {
  const modules = new Set<string>();
  for (const evt of events) {
    const linked =
      evt.linked_decision_id === adr.id ||
      evt.decision === adr.id ||
      evt.title.toLowerCase().includes(adr.title.toLowerCase().slice(0, 16));
    if (!linked) {
      continue;
    }
    for (const file of evt.files ?? []) {
      if (/\.(ts|tsx|js|jsx|py|go|rs)$/.test(file)) {
        modules.add(file.replace(/\\/g, '/'));
      }
    }
  }
  return [...modules].slice(0, 12);
}

export function buildDecisionDependencyGraph(
  adrs: AdrRecord[],
  events: CognitiveEvent[],
  assumptionGraph?: AssumptionGraphArtifact,
): DecisionDependencyGraphArtifact {
  const graph = assumptionGraph ?? buildAssumptionGraph(adrs);
  const byDecision = new Map<string, string[]>();
  for (const node of graph.assumptions) {
    const list = byDecision.get(node.decision_id) ?? [];
    list.push(node.id);
    byDecision.set(node.decision_id, list);
  }

  const decisions: DecisionDependencyNode[] = adrs
    .filter((a) => a.status !== 'rejected')
    .map((adr) => {
      const text = `${adr.title} ${adr.reason}`;
      const deps = extractTechDependencies(text);
      const assumptions = byDecision.get(adr.id) ?? [];
      if (!assumptions.length) {
        extractAdrAssumptions(adr).forEach((_, idx) => {
          assumptions.push(`A-${adr.id}-${idx + 1}`);
        });
      }
      return {
        decision: adr.id,
        depends_on: {
          assumptions,
          modules: modulesForDecision(adr, events),
          dependencies: deps,
          owners: [],
        },
      };
    });

  return {
    schema: DECISION_DEPENDENCY_GRAPH_SCHEMA,
    updated_at: new Date().toISOString(),
    decisions,
  };
}

export async function persistDecisionDependencyGraph(
  workspaceRoot: string,
  adrs: AdrRecord[],
): Promise<DecisionDependencyGraphArtifact> {
  const events = await readAllCognitiveEvents(workspaceRoot).catch(() => []);
  const assumptionGraph = buildAssumptionGraph(adrs);
  const artifact = buildDecisionDependencyGraph(adrs, events, assumptionGraph);
  await fs.mkdir(path.dirname(decisionDependencyGraphPath(workspaceRoot)), { recursive: true });
  await fs.writeFile(
    decisionDependencyGraphPath(workspaceRoot),
    `${JSON.stringify(artifact, null, 2)}\n`,
    'utf8',
  );
  return artifact;
}

export async function readDecisionDependencyGraph(
  workspaceRoot: string,
): Promise<DecisionDependencyGraphArtifact | null> {
  try {
    const raw = JSON.parse(
      await fs.readFile(decisionDependencyGraphPath(workspaceRoot), 'utf8'),
    ) as DecisionDependencyGraphArtifact;
    if (raw?.schema === DECISION_DEPENDENCY_GRAPH_SCHEMA && Array.isArray(raw.decisions)) {
      return raw;
    }
  } catch {
    // missing graph
  }
  return null;
}
