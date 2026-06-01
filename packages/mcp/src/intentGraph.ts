import * as fs from 'node:fs/promises';
import { intentGraphFile } from './paths.js';

export interface McpIntentGraph {
  version: number;
  updatedAt: number;
  nodes: Array<{
    id: string;
    text: string;
    status: string;
    confidence: number;
    relatedFiles: string[];
    lastUpdated: number;
    learnedAt: number;
  }>;
  edges: Array<{ from: string; to: string; type: string }>;
}

export async function loadIntentGraph(workspaceRoot: string): Promise<McpIntentGraph | null> {
  const fp = intentGraphFile(workspaceRoot);
  try {
    const text = await fs.readFile(fp, 'utf8');
    const o = JSON.parse(text) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || o.version !== 1) {
      return null;
    }
    return {
      version: 1,
      updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0,
      nodes: Array.isArray(o.nodes)
        ? o.nodes
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map((n) => ({
              id: typeof n.id === 'string' ? n.id : '',
              text: typeof n.text === 'string' ? n.text : '',
              status: typeof n.status === 'string' ? n.status : 'PARTIAL',
              confidence: typeof n.confidence === 'number' ? n.confidence : 0,
              relatedFiles: Array.isArray(n.relatedFiles)
                ? n.relatedFiles.filter((f): f is string => typeof f === 'string')
                : [],
              lastUpdated: typeof n.lastUpdated === 'number' ? n.lastUpdated : 0,
              learnedAt: typeof n.learnedAt === 'number' ? n.learnedAt : 0,
            }))
            .filter((n) => n.id && n.text)
        : [],
      edges: Array.isArray(o.edges)
        ? o.edges
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map((e) => ({
              from: typeof e.from === 'string' ? e.from : '',
              to: typeof e.to === 'string' ? e.to : '',
              type: typeof e.type === 'string' ? e.type : 'RELATED_TO',
            }))
            .filter((e) => e.from && e.to)
        : [],
    };
  } catch {
    return null;
  }
}

export function activeIntentNodes(graph: McpIntentGraph, max = 8): McpIntentGraph['nodes'] {
  return graph.nodes
    .filter((n) => n.status === 'ACTIVE' || n.status === 'WEAKENING' || n.status === 'PARTIAL')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, max);
}
