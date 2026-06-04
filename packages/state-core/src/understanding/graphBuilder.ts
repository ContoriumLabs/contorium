import type { GraphEdge, GraphNode, ProjectGraph } from './types.js';
import type { ChangeArtifact, KeyChange } from './types.js';
import { UNDERSTANDING_VERSION } from './types.js';
import {
  extractFile,
  nodeId,
  resolveRelativeImport,
  symbolNamesByKind,
  type FileExtraction,
} from './extractor.js';
import { refineExtraction } from './symbolValidator.js';

const MAX_NODES = 240;
const MAX_NEIGHBOR_FILES = 12;

function moduleNodeId(file: string): string {
  return nodeId(file, 'module', file);
}

export async function buildChangeNeighborhoodGraph(
  workspaceRoot: string,
  changedFiles: string[],
  now = Date.now(),
): Promise<{ graph: ProjectGraph; extractions: Map<string, FileExtraction> }> {
  const extractions = new Map<string, FileExtraction>();
  const neighborFiles = new Set<string>(changedFiles);

  for (const file of changedFiles) {
    const ext = await extractFile(workspaceRoot, file);
    if (!ext) {
      continue;
    }
    extractions.set(file, refineExtraction(ext));
    for (const sym of ext.symbols) {
      if (sym.kind === 'import' && sym.importTarget) {
        const resolved = resolveRelativeImport(file, sym.importTarget);
        if (resolved && neighborFiles.size < changedFiles.length + MAX_NEIGHBOR_FILES) {
          neighborFiles.add(resolved);
        }
      }
    }
  }

  for (const file of neighborFiles) {
    if (extractions.has(file)) {
      continue;
    }
    const ext = await extractFile(workspaceRoot, file);
    if (ext) {
      extractions.set(file, refineExtraction(ext));
    }
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const [file, ext] of extractions) {
    nodes.push({ id: moduleNodeId(file), kind: 'module', name: file, file });
    for (const sym of ext.symbols) {
      const id = nodeId(file, sym.kind, sym.name);
      if (sym.kind === 'function' || sym.kind === 'class') {
        nodes.push({ id, kind: sym.kind, name: sym.name, file, line: sym.line });
        edges.push({ from: moduleNodeId(file), to: id, kind: 'contains' });
      } else if (sym.kind === 'import') {
        nodes.push({ id, kind: 'import', name: sym.name, file, line: sym.line });
        edges.push({ from: moduleNodeId(file), to: id, kind: 'imports' });
      }
    }
  }

  for (const [file, ext] of extractions) {
    const localFns = new Set(symbolNamesByKind(ext, 'function'));
    for (const call of ext.calls) {
      if (!localFns.has(call)) {
        continue;
      }
      const fromCandidates = ext.symbols.filter((s) => s.kind === 'function');
      for (const caller of fromCandidates) {
        const fromId = nodeId(file, 'function', caller.name);
        const toId = nodeId(file, 'function', call);
        if (fromId !== toId) {
          edges.push({ from: fromId, to: toId, kind: 'calls' });
        }
      }
    }
  }

  const cappedNodes = nodes.slice(0, MAX_NODES);
  const nodeIds = new Set(cappedNodes.map((n) => n.id));
  const cappedEdges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)).slice(0, MAX_NODES * 2);

  return {
    graph: {
      version: 2,
      generatedAt: now,
      scope: 'change-neighborhood',
      nodes: cappedNodes,
      edges: cappedEdges,
    },
    extractions,
  };
}

export function deriveChangeArtifact(
  changedFiles: string[],
  extractions: Map<string, FileExtraction>,
  now = Date.now(),
): ChangeArtifact {
  const key_changes: KeyChange[] = [];
  for (const file of changedFiles) {
    key_changes.push({ symbol: file, kind: 'file', change_type: 'modified' });
    const ext = extractions.get(file);
    if (!ext) {
      continue;
    }
    for (const fn of symbolNamesByKind(ext, 'function')) {
      key_changes.push({ symbol: `${file}::${fn}`, kind: 'function', change_type: 'modified' });
    }
    for (const cls of symbolNamesByKind(ext, 'class')) {
      key_changes.push({ symbol: `${file}::${cls}`, kind: 'class', change_type: 'modified' });
    }
  }
  return {
    version: UNDERSTANDING_VERSION,
    generatedAt: now,
    changed_files: changedFiles,
    key_changes,
  };
}
