import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  intentGraphVNextPath,
  intentNodesPath,
  legacyIntentGraphPath,
} from './paths.js';
import type { IntentGraphVNext, IntentNodeVNext } from './types.js';
import { INTENT_VNEXT_SCHEMA } from './types.js';

interface LegacyIntentNode {
  id: string;
  text: string;
  relatedFiles?: string[];
  lastUpdated?: number;
  learnedAt?: number;
}

interface LegacyIntentGraph {
  version?: number;
  updatedAt?: number;
  nodes?: LegacyIntentNode[];
  edges?: Array<{ from: string; to: string; type: string }>;
}

async function readLegacyIntentGraph(workspaceRoot: string): Promise<LegacyIntentGraph | null> {
  try {
    const text = await fs.readFile(legacyIntentGraphPath(workspaceRoot), 'utf8');
    return JSON.parse(text) as LegacyIntentGraph;
  } catch {
    return null;
  }
}

function toVNextNode(node: LegacyIntentNode): IntentNodeVNext {
  const now = new Date(node.lastUpdated ?? node.learnedAt ?? Date.now()).toISOString();
  const modules = (node.relatedFiles ?? [])
    .map((f) => f.replace(/\\/g, '/').split('/')[0])
    .filter(Boolean);
  return {
    intent_id: node.id,
    title: node.text.length > 64 ? `${node.text.slice(0, 61)}…` : node.text,
    name: node.text.length > 64 ? `${node.text.slice(0, 61)}…` : node.text,
    description: node.text,
    why: node.text,
    design_principles: [],
    constraints: node.relatedFiles?.length ? [`scoped to ${node.relatedFiles.length} path(s)`] : [],
    related_modules: [...new Set(modules)],
    linked_decisions: [],
    created_at: now,
    updated_at: now,
  };
}

export async function readIntentNodesVNext(workspaceRoot: string): Promise<IntentNodeVNext[]> {
  try {
    const text = await fs.readFile(intentNodesPath(workspaceRoot), 'utf8');
    const raw = JSON.parse(text) as { nodes?: IntentNodeVNext[] };
    return Array.isArray(raw.nodes) ? raw.nodes : [];
  } catch {
    const legacy = await readLegacyIntentGraph(workspaceRoot);
    return (legacy?.nodes ?? []).map(toVNextNode);
  }
}

export async function deriveIntentGraphVNext(workspaceRoot: string): Promise<IntentGraphVNext | null> {
  const legacy = await readLegacyIntentGraph(workspaceRoot);
  if (!legacy?.nodes?.length) {
    return null;
  }

  const nodes = legacy.nodes.map(toVNextNode);
  const graph: IntentGraphVNext = {
    schema: INTENT_VNEXT_SCHEMA,
    updated_at: new Date(legacy.updatedAt ?? Date.now()).toISOString(),
    nodes,
    edges: (legacy.edges ?? []).map((e) => ({ from: e.from, to: e.to, type: e.type })),
  };

  await fs.mkdir(path.dirname(intentNodesPath(workspaceRoot)), { recursive: true });
  await Promise.all([
    fs.writeFile(intentGraphVNextPath(workspaceRoot), `${JSON.stringify(graph, null, 2)}\n`, 'utf8'),
    fs.writeFile(intentNodesPath(workspaceRoot), `${JSON.stringify({ nodes }, null, 2)}\n`, 'utf8'),
  ]);

  return graph;
}

/** @deprecated Use deriveIntentGraphVNext — reflects legacy intent-graph into vNext paths. */
export async function mirrorIntentGraphVNext(workspaceRoot: string): Promise<IntentGraphVNext | null> {
  return deriveIntentGraphVNext(workspaceRoot);
}

/** Project (write) vNext intent graph from caller-supplied nodes. */
export async function projectIntentGraphVNext(
  workspaceRoot: string,
  graph: IntentGraphVNext,
): Promise<void> {
  await fs.mkdir(path.dirname(intentNodesPath(workspaceRoot)), { recursive: true });
  await Promise.all([
    fs.writeFile(intentGraphVNextPath(workspaceRoot), `${JSON.stringify(graph, null, 2)}\n`, 'utf8'),
    fs.writeFile(
      intentNodesPath(workspaceRoot),
      `${JSON.stringify({ nodes: graph.nodes }, null, 2)}\n`,
      'utf8',
    ),
  ]);
}

export async function readIntentGraphVNext(workspaceRoot: string): Promise<IntentGraphVNext | null> {
  try {
    const text = await fs.readFile(intentGraphVNextPath(workspaceRoot), 'utf8');
    const raw = JSON.parse(text) as IntentGraphVNext;
    if (raw?.schema === INTENT_VNEXT_SCHEMA) {
      return raw;
    }
    return null;
  } catch {
    return deriveIntentGraphVNext(workspaceRoot);
  }
}
