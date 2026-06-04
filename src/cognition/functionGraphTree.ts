import type { HandoffArtifact, ProjectGraph } from '@contora/state-core';

export interface FnTreeNode {
  name: string;
  file: string;
  kind: 'function' | 'class';
  children: FnTreeNode[];
}

export interface FileFlowLine {
  file: string;
  chain: string[];
}

export interface ImpactLine {
  target: string;
  effect: string;
  level: 'low' | 'medium' | 'high';
}

export interface FunctionGraphView {
  trees: FnTreeNode[];
  fileFlows: FileFlowLine[];
  impactLines: ImpactLine[];
  empty: boolean;
}

const MAX_ROOTS = 3;
const MAX_DEPTH = 5;
const MAX_CHILDREN = 8;

function basename(file: string): string {
  const parts = file.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? file;
}

function buildCallAdjacency(graph: ProjectGraph): {
  fnById: Map<string, { name: string; file: string; kind: 'function' | 'class' }>;
  children: Map<string, string[]>;
  parents: Map<string, string[]>;
} {
  const fnById = new Map<string, { name: string; file: string; kind: 'function' | 'class' }>();
  for (const n of graph.nodes) {
    if (n.kind === 'function' || n.kind === 'class') {
      fnById.set(n.id, { name: n.name, file: n.file, kind: n.kind });
    }
  }
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.kind !== 'calls' || !fnById.has(e.from) || !fnById.has(e.to)) {
      continue;
    }
    const ch = children.get(e.from) ?? [];
    if (!ch.includes(e.to)) {
      ch.push(e.to);
    }
    children.set(e.from, ch);
    const par = parents.get(e.to) ?? [];
    if (!par.includes(e.from)) {
      par.push(e.from);
    }
    parents.set(e.to, par);
  }
  return { fnById, children, parents };
}

function expandTree(
  id: string,
  fnById: Map<string, { name: string; file: string; kind: 'function' | 'class' }>,
  children: Map<string, string[]>,
  depth: number,
  visiting: Set<string>,
): FnTreeNode | undefined {
  if (depth > MAX_DEPTH || visiting.has(id)) {
    return undefined;
  }
  const meta = fnById.get(id);
  if (!meta) {
    return undefined;
  }
  visiting.add(id);
  const childIds = (children.get(id) ?? []).slice(0, MAX_CHILDREN);
  const kids: FnTreeNode[] = [];
  for (const cid of childIds) {
    const sub = expandTree(cid, fnById, children, depth + 1, visiting);
    if (sub) {
      kids.push(sub);
    }
  }
  visiting.delete(id);
  const suffix = meta.kind === 'function' ? '()' : '';
  return {
    name: meta.name + suffix,
    file: meta.file,
    kind: meta.kind,
    children: kids,
  };
}

function buildCallTrees(graph: ProjectGraph, preferredFiles: Set<string>): FnTreeNode[] {
  const { fnById, children, parents } = buildCallAdjacency(graph);
  if (!fnById.size) {
    return [];
  }

  const roots: string[] = [];
  for (const id of fnById.keys()) {
    if (!(parents.get(id)?.length)) {
      roots.push(id);
    }
  }

  const scoreRoot = (id: string): number => {
    const meta = fnById.get(id);
    if (!meta) {
      return 0;
    }
    let s = (children.get(id)?.length ?? 0) * 2;
    if (preferredFiles.has(meta.file)) {
      s += 10;
    }
    return s;
  };

  const sortedRoots = [...roots].sort((a, b) => scoreRoot(b) - scoreRoot(a));
  let pick = sortedRoots.slice(0, MAX_ROOTS);

  if (!pick.length) {
    pick = [...fnById.keys()]
      .sort((a, b) => scoreRoot(b) - scoreRoot(a))
      .slice(0, MAX_ROOTS);
  }

  const trees: FnTreeNode[] = [];
  for (const id of pick) {
    const t = expandTree(id, fnById, children, 0, new Set());
    if (t) {
      trees.push(t);
    }
  }
  return trees;
}

function buildFileFlows(graph: ProjectGraph, handoff?: HandoffArtifact): FileFlowLine[] {
  const files = new Set<string>();
  for (const k of handoff?.key_changes ?? []) {
    if (k.kind === 'file') {
      files.add(k.symbol);
    } else {
      const f = k.symbol.split('::')[0];
      if (f) {
        files.add(f);
      }
    }
  }
  if (!files.size) {
    for (const n of graph.nodes) {
      if (n.kind === 'module') {
        files.add(n.file);
      }
    }
  }

  const { fnById, children, parents } = buildCallAdjacency(graph);
  const lines: FileFlowLine[] = [];

  for (const file of [...files].slice(0, 4)) {
    const fns = [...fnById.entries()]
      .filter(([, m]) => m.file === file)
      .map(([id]) => id);
    if (!fns.length) {
      lines.push({ file: basename(file), chain: [basename(file)] });
      continue;
    }
    const entry = fns.find((id) => !(parents.get(id)?.length)) ?? fns[0]!;
    const chain: string[] = [basename(file)];
    const meta = fnById.get(entry);
    if (meta) {
      chain.push(meta.name + (meta.kind === 'function' ? '()' : ''));
    }
    const next = (children.get(entry) ?? [])[0];
    if (next) {
      const nm = fnById.get(next);
      if (nm) {
        chain.push(nm.name + (nm.kind === 'function' ? '()' : ''));
      }
    }
    lines.push({ file: basename(file), chain });
  }
  return lines;
}

function buildImpactLines(handoff?: HandoffArtifact): ImpactLine[] {
  if (!handoff) {
    return [];
  }
  const risk = handoff.impact_summary.risk;
  const lines: ImpactLine[] = [];
  for (const fn of handoff.impact_summary.affected_functions.slice(0, 6)) {
    const short = fn.split('::').pop() ?? fn;
    lines.push({
      target: short,
      effect: 'direct caller of changed symbol',
      level: risk,
    });
  }
  for (const mod of handoff.impact_summary.affected_modules.slice(0, 4)) {
    if (lines.length >= 8) {
      break;
    }
    lines.push({
      target: basename(mod),
      effect: 'module in change neighborhood',
      level: risk === 'high' ? 'medium' : 'low',
    });
  }
  return lines;
}

/** Build Cortex function graph + dependency impact view from V3.1 artifacts. */
export function buildFunctionGraphView(
  graph?: ProjectGraph | null,
  handoff?: HandoffArtifact | null,
): FunctionGraphView {
  if (!graph?.nodes?.length) {
    const impactOnly = buildImpactLines(handoff ?? undefined);
    return {
      trees: [],
      fileFlows: [],
      impactLines: impactOnly,
      empty: !impactOnly.length,
    };
  }

  const preferred = new Set<string>();
  for (const k of handoff?.key_changes ?? []) {
    if (k.kind === 'file') {
      preferred.add(k.symbol);
    } else {
      const f = k.symbol.split('::')[0];
      if (f) {
        preferred.add(f);
      }
    }
  }

  const trees = buildCallTrees(graph, preferred);
  const fileFlows = buildFileFlows(graph, handoff ?? undefined);
  const impactLines = buildImpactLines(handoff ?? undefined);

  return {
    trees,
    fileFlows,
    impactLines,
    empty: !trees.length && !fileFlows.length && !impactLines.length,
  };
}
