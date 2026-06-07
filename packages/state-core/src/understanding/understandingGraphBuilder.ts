import type { AdapterKind } from '../types.js';
import type { ChangeArtifact, HandoffArtifact, ProjectGraph } from './types.js';

/** Runtime Understanding Graph — call chains + impact from recent changes. */
export interface UnderstandingGraph {
  version: 1;
  generatedAt: number;
  recent_change: {
    name: string;
    file?: string;
    change_type?: string;
  };
  call_chain: string[];
  affected: string[];
  agent: string;
}

function nodeName(graph: ProjectGraph, id: string): string | undefined {
  return graph.nodes.find((n) => n.id === id)?.name;
}

function buildCallChain(graph: ProjectGraph, seedSymbol: string, maxDepth = 6): string[] {
  const seed = graph.nodes.find(
    (n) => n.name === seedSymbol && (n.kind === 'function' || n.kind === 'class'),
  );
  if (!seed) {
    return [seedSymbol];
  }

  const chain: string[] = [seed.name];
  const callEdges = graph.edges.filter((e) => e.kind === 'calls');
  let current = seed.id;
  const visited = new Set<string>([current]);

  for (let depth = 0; depth < maxDepth; depth++) {
    const edge = callEdges.find((e) => e.from === current);
    if (!edge || visited.has(edge.to)) {
      break;
    }
    visited.add(edge.to);
    const name = nodeName(graph, edge.to);
    if (!name) {
      break;
    }
    chain.push(name);
    current = edge.to;
  }

  return chain;
}

export function buildUnderstandingGraph(args: {
  graph: ProjectGraph;
  change: ChangeArtifact;
  handoff: HandoffArtifact;
  agent?: AdapterKind | string;
  now?: number;
}): UnderstandingGraph | undefined {
  const fnChange =
    args.handoff.key_changes.find((k) => k.kind === 'function' || k.kind === 'class') ??
    args.change.key_changes.find((k) => k.kind === 'function' || k.kind === 'class');

  if (!fnChange) {
    const affected = args.handoff.impact_summary.affected_functions.slice(0, 8);
    if (!affected.length) {
      return undefined;
    }
    return {
      version: 1,
      generatedAt: args.now ?? Date.now(),
      recent_change: { name: '(file-level)', change_type: 'modified' },
      call_chain: affected.slice(0, 4),
      affected,
      agent: String(args.agent ?? 'runtime'),
    };
  }

  const displayName = fnChange.kind === 'function' ? `${fnChange.symbol}()` : fnChange.symbol;
  const call_chain = buildCallChain(args.graph, fnChange.symbol);
  const affected = [
    ...new Set([
      ...args.handoff.impact_summary.affected_functions,
      ...call_chain.map((n) => (n.endsWith('()') ? n : `${n}()`)),
    ]),
  ].slice(0, 12);

  return {
    version: 1,
    generatedAt: args.now ?? Date.now(),
    recent_change: {
      name: displayName,
      change_type: fnChange.change_type,
    },
    call_chain: call_chain.map((n) => (n.endsWith('()') ? n : `${n}()`)),
    affected,
    agent: String(args.agent ?? 'runtime'),
  };
}
