import type { ProjectBuiltState } from '../../state-builder/types.js';
import type { ChangeArtifact, IntentFusion, ProjectGraph } from '../types.js';
import {
  mapIntentsToFunctions,
  type FunctionDescriptor,
  type IntentDescriptor,
  type MappingContext,
} from './intentFunctionMapper.js';
import { buildGraphMetadata } from './normalize.js';
import { buildHotspots } from './hotspotBuilder.js';
import { buildKnowledgeSnapshot } from './snapshotBuilder.js';
import { filterCanonicalEdges, splitMappingsByCanonicalThreshold } from './confidence.js';
import type {
  IntentFunctionMapping,
  KnowledgeEdge,
  KnowledgeGraphTreeNode,
  KnowledgeNode,
  ProjectKnowledgeGraph,
  ReasonTraceItem,
} from './types.js';

const MAX_INTENTS = 6;
const MAX_FUNCTIONS = 80;

function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

function basename(p: string): string {
  const parts = norm(p).split('/').filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

function moduleFromPath(file: string): string {
  const parts = norm(file).split('/').filter(Boolean);
  if (parts.length <= 1) {
    return parts[0] ?? 'root';
  }
  if (parts[0] === 'packages' && parts[1]) {
    return parts[1]!;
  }
  if (parts[0] === 'src' && parts[1]) {
    return parts[1]!;
  }
  return parts[0]!;
}

function intentId(name: string, idx: number): string {
  return `intent_${idx}_${name.slice(0, 24).replace(/\W+/g, '_')}`;
}

function moduleId(name: string): string {
  return `mod::${name}`;
}

function fileId(file: string): string {
  return `file::${norm(file)}`;
}

function fnNodeId(file: string, name: string, kind: string): string {
  return `${norm(file)}::${kind}::${name}`;
}

function collectIntents(args: {
  goal: string;
  intent: IntentFusion;
  built?: ProjectBuiltState | null;
}): IntentDescriptor[] {
  const out: IntentDescriptor[] = [];
  const seen = new Set<string>();

  const add = (text: string) => {
    const t = text.trim();
    if (t.length < 4 || seen.has(t.toLowerCase())) {
      return;
    }
    seen.add(t.toLowerCase());
    out.push({ id: intentId(t, out.length), text: t });
  };

  if (args.goal) {
    add(args.goal);
  }
  const focusBase = args.intent.focus.split('—')[0]?.trim() ?? args.intent.focus;
  if (focusBase && focusBase.toLowerCase() !== args.goal.toLowerCase()) {
    add(focusBase);
  }
  for (const mod of args.built?.active_modules ?? []) {
    const label = mod.includes('/') ? basename(mod) : mod;
    if (/doc|mcp|auth|ui|test|build/i.test(label) || label.length > 3) {
      add(`${label} integration`.replace(/ integration integration/, ' integration'));
    }
  }
  for (const action of args.built?.next_actions ?? []) {
    if (/documentation|mcp|auth|build|test/i.test(action)) {
      add(action);
    }
  }

  return out.slice(0, MAX_INTENTS);
}

function edgeConfidence(type: KnowledgeEdge['type'], weight: number): number {
  if (type === 'supports_intent') {
    return weight;
  }
  if (type === 'calls') {
    return 0.8;
  }
  return 0.95;
}

function mappingByFn(mappings: IntentFunctionMapping[]): Map<string, IntentFunctionMapping> {
  const out = new Map<string, IntentFunctionMapping>();
  for (const m of mappings) {
    const prev = out.get(m.functionId);
    if (!prev || prev.score < m.score) {
      out.set(m.functionId, m);
    }
  }
  return out;
}

function buildIntentTrees(
  intents: IntentDescriptor[],
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  mappings: IntentFunctionMapping[],
): KnowledgeGraphTreeNode[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = (id: string, type?: KnowledgeEdge['type']): string[] =>
    edges
      .filter((e) => e.source === id && (!type || e.type === type))
      .sort((a, b) => b.weight - a.weight)
      .map((e) => e.target);

  const fnToIntent = new Map<string, string>();
  const confidenceByFn = mappingByFn(mappings);
  for (const m of mappings) {
    if (!fnToIntent.has(m.functionId) || (mappings.find((x) => x.functionId === m.functionId)?.score ?? 0) < m.score) {
      fnToIntent.set(m.functionId, m.intentId);
    }
  }

  const trees: KnowledgeGraphTreeNode[] = [];

  for (const intent of intents) {
    const intentModules = childrenOf(intent.id, 'supports_intent');
    const modChildren: KnowledgeGraphTreeNode[] = [];

    for (const modNodeId of intentModules) {
      const modNode = nodeById.get(modNodeId);
      if (!modNode) {
        continue;
      }
      const fileNodes = childrenOf(modNodeId, 'contains');
      const fileChildren: KnowledgeGraphTreeNode[] = [];

      for (const fId of fileNodes) {
        const fNode = nodeById.get(fId);
        if (!fNode || fNode.type !== 'file') {
          continue;
        }
        const fnIds = childrenOf(fId, 'contains').filter((id) => {
          const n = nodeById.get(id);
          return n && (n.type === 'function' || n.type === 'class') && fnToIntent.get(id) === intent.id;
        });
        const fnChildren: KnowledgeGraphTreeNode[] = fnIds.slice(0, 8).map((id) => {
          const n = nodeById.get(id)!;
          const map = confidenceByFn.get(id);
          const callIds = childrenOf(id, 'calls').slice(0, 6);
          return {
            id: n.id,
            type: n.type,
            name: n.name + (n.type === 'function' ? '()' : ''),
            path: n.path,
            confidence: map?.confidence,
            children: callIds.map((cid) => {
              const c = nodeById.get(cid)!;
              return {
                id: c.id,
                type: c.type,
                name: c.name + (c.type === 'function' ? '()' : ''),
                path: c.path,
                children: [],
              };
            }),
          };
        });
        if (fnChildren.length) {
          fileChildren.push({
            id: fNode.id,
            type: 'file',
            name: basename(fNode.path ?? fNode.name),
            path: fNode.path,
            children: fnChildren,
          });
        }
      }

      if (fileChildren.length) {
        modChildren.push({
          id: modNode.id,
          type: 'module',
          name: modNode.name,
          children: fileChildren,
        });
      }
    }

    if (modChildren.length) {
      trees.push({
        id: intent.id,
        type: 'intent',
        name: intent.text,
        expanded: trees.length === 0,
        children: modChildren,
      });
    }
  }

  return trees;
}

function buildReasonTraces(
  functions: FunctionDescriptor[],
  mappings: IntentFunctionMapping[],
  edges: KnowledgeEdge[],
  editCounts: Map<string, number>,
  intentById: Map<string, IntentDescriptor>,
): ReasonTraceItem[] {
  const intentForFn = new Map<string, IntentFunctionMapping>();
  for (const m of mappings) {
    const prev = intentForFn.get(m.functionId);
    if (!prev || prev.score < m.score) {
      intentForFn.set(m.functionId, m);
    }
  }

  const depCount = (fnId: string): number =>
    edges.filter((e) => e.source === fnId && e.type === 'calls').length +
    edges.filter((e) => e.target === fnId && e.type === 'calls').length;

  const out: ReasonTraceItem[] = [];
  for (const fn of functions) {
    const edits = editCounts.get(norm(fn.file)) ?? 0;
    const deps = depCount(fn.id);
    const map = intentForFn.get(fn.id);
    const reasons: string[] = [];
    if (edits >= 3) {
      reasons.push(`edited ${edits} times in recent activity`);
    } else if (edits > 0) {
      reasons.push('recently edited file');
    }
    if (map) {
      reasons.push(`linked to active intent (confidence ${Math.round(map.confidence * 100)}%)`);
      if (map.signals.length) {
        reasons.push(map.signals.join(', '));
      }
    }
    if (deps >= 4) {
      reasons.push(`high dependency count (${deps})`);
    }
    if (!reasons.length) {
      continue;
    }
    const intent = map ? intentById.get(map.intentId) : undefined;
    out.push({
      targetId: fn.id,
      targetName: fn.name,
      targetType: 'function',
      reasons,
      editCount: edits,
      dependencyCount: deps,
      linkedIntent: intent?.text,
      confidence: map?.confidence,
    });
  }
  return out
    .sort((a, b) => b.editCount - a.editCount || b.dependencyCount - a.dependencyCount)
    .slice(0, 10);
}

export interface KnowledgeGraphBuildInput {
  graph: ProjectGraph;
  change: ChangeArtifact;
  intent: IntentFusion;
  built?: ProjectBuiltState | null;
  goal: string;
  workspaceRoot?: string;
  sourceVersion?: string;
  now?: number;
  editCounts?: Map<string, number>;
  gitFrequency?: Map<string, number>;
  rebuildTrigger?: string;
  lastCommitHash?: string;
}

/**
 * Build Project Knowledge Graph from L1/L2 sources only.
 * L3 (intelligence / intent-graph / AI speculation) must never feed this builder.
 */
export function buildProjectKnowledgeGraph(input: KnowledgeGraphBuildInput): ProjectKnowledgeGraph {
  const now = input.now ?? Date.now();
  const editCounts = input.editCounts ?? new Map<string, number>();
  for (const f of input.change.changed_files) {
    const k = norm(f);
    editCounts.set(k, (editCounts.get(k) ?? 0) + 1);
  }

  const intents = collectIntents(input);
  const intentById = new Map(intents.map((i) => [i.id, i]));
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const moduleSet = new Set<string>();

  for (const intent of intents) {
    nodes.push({
      id: intent.id,
      type: 'intent',
      name: intent.text,
      updatedAt: now,
    });
  }

  for (const n of input.graph.nodes) {
    if (n.kind === 'module') {
      const mod = moduleFromPath(n.file);
      moduleSet.add(mod);
    }
  }
  for (const f of input.change.changed_files) {
    moduleSet.add(moduleFromPath(f));
  }
  for (const mod of input.built?.active_modules ?? []) {
    moduleSet.add(basename(mod) || mod);
  }

  for (const mod of moduleSet) {
    nodes.push({
      id: moduleId(mod),
      type: 'module',
      name: mod,
      path: mod,
      updatedAt: now,
    });
  }

  const fileNodes = new Set<string>();
  const functions: FunctionDescriptor[] = [];

  for (const n of input.graph.nodes) {
    if (n.kind === 'module') {
      const fid = fileId(n.file);
      if (!fileNodes.has(fid)) {
        fileNodes.add(fid);
        nodes.push({
          id: fid,
          type: 'file',
          name: basename(n.file),
          path: norm(n.file),
          updatedAt: now,
        });
      }
      const mod = moduleId(moduleFromPath(n.file));
      edges.push({
        source: mod,
        target: fid,
        type: 'contains',
        weight: 1,
        confidence: edgeConfidence('contains', 1),
      });
    }
    if (n.kind === 'function' || n.kind === 'class') {
      const fid = fileId(n.file);
      if (!fileNodes.has(fid)) {
        fileNodes.add(fid);
        nodes.push({
          id: fid,
          type: 'file',
          name: basename(n.file),
          path: norm(n.file),
          updatedAt: now,
        });
        const mod = moduleId(moduleFromPath(n.file));
        edges.push({
        source: mod,
        target: fid,
        type: 'contains',
        weight: 1,
        confidence: edgeConfidence('contains', 1),
      });
      }
      nodes.push({
        id: n.id,
        type: n.kind,
        name: n.name,
        path: norm(n.file),
        metadata: n.line ? { line: n.line } : undefined,
        updatedAt: now,
      });
      edges.push({
        source: fid,
        target: n.id,
        type: 'contains',
        weight: 1,
        confidence: edgeConfidence('contains', 1),
      });
      if (n.kind === 'function') {
        const callTargets = input.graph.edges
          .filter((e) => e.from === n.id && e.kind === 'calls')
          .map((e) => input.graph.nodes.find((x) => x.id === e.to)?.name)
          .filter((x): x is string => !!x);
        functions.push({
          id: n.id,
          name: n.name,
          file: norm(n.file),
          moduleHint: moduleFromPath(n.file),
          callTargets,
        });
      }
    }
  }

  for (const e of input.graph.edges) {
    if (e.kind === 'calls') {
      edges.push({
        source: e.from,
        target: e.to,
        type: 'calls',
        weight: 0.8,
        confidence: edgeConfidence('calls', 0.8),
      });
    }
  }

  const ctx: MappingContext = {
    recentEditFiles: new Set(input.change.changed_files.map(norm)),
    gitFrequency: input.gitFrequency,
  };
  const rawMappings = mapIntentsToFunctions(intents, functions.slice(0, MAX_FUNCTIONS), ctx);
  const { canonical: intentMappings, inference: inferenceMappings } =
    splitMappingsByCanonicalThreshold(rawMappings);

  for (const m of intentMappings) {
    const fn = functions.find((f) => f.id === m.functionId);
    if (!fn) {
      continue;
    }
    const mod = moduleId(fn.moduleHint ?? moduleFromPath(fn.file));
    edges.push({
      source: m.intentId,
      target: mod,
      type: 'supports_intent',
      weight: m.score,
      confidence: m.confidence,
    });
  }

  const canonicalEdges = filterCanonicalEdges(edges);

  const reasonTraces = buildReasonTraces(
    functions,
    [...intentMappings, ...inferenceMappings],
    canonicalEdges,
    editCounts,
    intentById,
  );

  const intentTrees = buildIntentTrees(intents, nodes, canonicalEdges, intentMappings);

  const hotspots = buildHotspots({
    nodes,
    edges: canonicalEdges,
    intentMappings,
    editCounts,
    gitFrequency: input.gitFrequency ?? new Map(),
    now,
  });

  const snapshot = buildKnowledgeSnapshot({
    nodes,
    edges: canonicalEdges,
    intentMappings,
    hotspots,
    nextActions: input.built?.next_actions ?? [],
    now,
  });

  return {
    meta: buildGraphMetadata({
      workspaceRoot: input.workspaceRoot ?? 'unknown',
      now,
      sourceVersion: input.sourceVersion,
      rebuildTrigger: input.rebuildTrigger,
      lastCommitHash: input.lastCommitHash,
    }),
    nodes,
    edges: canonicalEdges,
    intentMappings,
    inferenceMappings,
    reasonTraces,
    intentTrees,
    hotspots,
    snapshot,
  };
}
