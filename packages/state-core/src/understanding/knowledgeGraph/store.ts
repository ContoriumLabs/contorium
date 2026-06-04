import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { normalizeKnowledgeGraph } from './normalize.js';
import type {
  KnowledgeNode,
  KnowledgeSnapshot,
  ProjectKnowledgeGraph,
} from './types.js';

function graphDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.contora', 'graph');
}

function knowledgePath(workspaceRoot: string): string {
  return path.join(graphDir(workspaceRoot), 'knowledge.json');
}

function snapshotPath(workspaceRoot: string): string {
  return path.join(graphDir(workspaceRoot), 'snapshot.json');
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function readProjectKnowledgeGraph(
  workspaceRoot: string,
): Promise<ProjectKnowledgeGraph | undefined> {
  const root = path.resolve(workspaceRoot);
  const kg = await readJson<unknown>(knowledgePath(root));
  return normalizeKnowledgeGraph(kg, root);
}

/** Snapshot Layer — compact graph summary for Handoff / MCP. */
export async function readKnowledgeSnapshot(
  workspaceRoot: string,
): Promise<KnowledgeSnapshot | undefined> {
  const root = path.resolve(workspaceRoot);
  const snap = await readJson<KnowledgeSnapshot>(snapshotPath(root));
  if (snap?.topIntents) {
    return snap;
  }
  const kg = await readProjectKnowledgeGraph(root);
  return kg?.snapshot;
}

export async function writeProjectKnowledgeGraph(
  workspaceRoot: string,
  graph: ProjectKnowledgeGraph,
): Promise<void> {
  const root = path.resolve(workspaceRoot);
  await writeJson(knowledgePath(root), graph);
  await writeGraphShards(root, graph);
}

/** Split shards for MCP / tooling (mirrors V3.1 doc layout). */
async function writeGraphShards(root: string, kg: ProjectKnowledgeGraph): Promise<void> {
  const dir = graphDir(root);
  const intents = kg.nodes.filter((n: KnowledgeNode) => n.type === 'intent');
  const functions = kg.nodes.filter(
    (n: KnowledgeNode) => n.type === 'function' || n.type === 'class',
  );
  const shardMeta = {
    schemaVersion: kg.meta.schemaVersion,
    generatedAt: kg.meta.generatedAt,
    graphBuildId: kg.meta.graphBuildId,
  };
  await Promise.all([
    writeJson(path.join(dir, 'metadata.json'), kg.meta),
    writeJson(path.join(dir, 'snapshot.json'), kg.snapshot),
    writeJson(path.join(dir, 'hotspots.json'), {
      ...shardMeta,
      hotspots: kg.hotspots,
    }),
    writeJson(path.join(dir, 'nodes.json'), { ...shardMeta, nodes: kg.nodes }),
    writeJson(path.join(dir, 'intents.json'), { ...shardMeta, nodes: intents }),
    writeJson(path.join(dir, 'functions.json'), { ...shardMeta, nodes: functions }),
    writeJson(path.join(dir, 'edges.json'), { ...shardMeta, edges: kg.edges }),
  ]);
}

export async function deleteProjectKnowledgeGraph(workspaceRoot: string): Promise<void> {
  const dir = graphDir(workspaceRoot);
  for (const name of [
    'knowledge.json',
    'metadata.json',
    'snapshot.json',
    'hotspots.json',
    'nodes.json',
    'intents.json',
    'functions.json',
    'edges.json',
  ]) {
    try {
      await fs.unlink(path.join(dir, name));
    } catch {
      /* absent */
    }
  }
}
