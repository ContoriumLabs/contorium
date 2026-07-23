import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AdrRecord } from '../cil/types.js';
import { extractAdrAssumptions } from './assumption.js';
import { assumptionGraphPath } from './governanceGraphPaths.js';
import type { AdrAssumption } from './types.js';

export const ASSUMPTION_GRAPH_SCHEMA = 'contorium.assumption_graph.v1' as const;

export type AssumptionCategory =
  | 'technology'
  | 'architecture'
  | 'business'
  | 'performance'
  | 'security'
  | 'ownership'
  | 'cost';

export interface AssumptionNode {
  id: string;
  decision_id: string;
  assumption: string;
  type: AssumptionCategory;
  verification_sources: string[];
}

export interface AssumptionGraphArtifact {
  schema: typeof ASSUMPTION_GRAPH_SCHEMA;
  updated_at: string;
  assumptions: AssumptionNode[];
}

function mapAssumptionType(type: AdrAssumption['type'], statement: string): AssumptionCategory {
  const lower = statement.toLowerCase();
  if (/owner|team|maintainer/.test(lower)) {
    return 'ownership';
  }
  if (/traffic|scale|users?|cost|budget|revenue/.test(lower)) {
    return type === 'BUSINESS_ASSUMPTION' ? 'business' : 'cost';
  }
  if (/latency|performance|throughput|rps|qps/.test(lower)) {
    return 'performance';
  }
  if (/security|auth|encrypt|compliance/.test(lower)) {
    return 'security';
  }
  if (/monolith|microservice|architecture|service mesh/.test(lower)) {
    return 'architecture';
  }
  return 'technology';
}

function verificationSourcesFor(adr: AdrRecord, statement: string): string[] {
  const sources = ['adr'];
  const lower = `${adr.title} ${adr.reason} ${statement}`.toLowerCase();
  if (/redis|postgres|sqlite|jwt|oauth|graphql|mcp/.test(lower)) {
    sources.push('package.json');
  }
  if (/module|service|\.ts|\.js/.test(lower)) {
    sources.push('code');
  }
  return sources;
}

export function buildAssumptionGraph(adrs: AdrRecord[]): AssumptionGraphArtifact {
  const assumptions: AssumptionNode[] = [];

  for (const adr of adrs) {
    const extracted = extractAdrAssumptions(adr);
    extracted.forEach((a, idx) => {
      assumptions.push({
        id: `A-${adr.id}-${idx + 1}`,
        decision_id: adr.id,
        assumption: a.statement,
        type: mapAssumptionType(a.type, a.statement),
        verification_sources: verificationSourcesFor(adr, a.statement),
      });
    });
  }

  return {
    schema: ASSUMPTION_GRAPH_SCHEMA,
    updated_at: new Date().toISOString(),
    assumptions,
  };
}

export async function persistAssumptionGraph(
  workspaceRoot: string,
  adrs: AdrRecord[],
): Promise<AssumptionGraphArtifact> {
  const artifact = buildAssumptionGraph(adrs);
  await fs.mkdir(path.dirname(assumptionGraphPath(workspaceRoot)), { recursive: true });
  await fs.writeFile(
    assumptionGraphPath(workspaceRoot),
    `${JSON.stringify(artifact, null, 2)}\n`,
    'utf8',
  );
  return artifact;
}

export async function readAssumptionGraph(workspaceRoot: string): Promise<AssumptionGraphArtifact | null> {
  try {
    const raw = JSON.parse(await fs.readFile(assumptionGraphPath(workspaceRoot), 'utf8')) as AssumptionGraphArtifact;
    if (raw?.schema === ASSUMPTION_GRAPH_SCHEMA && Array.isArray(raw.assumptions)) {
      return raw;
    }
  } catch {
    // missing graph
  }
  return null;
}
