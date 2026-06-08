import type { ChangeArtifact, KeyChange, ProjectGraph, ProjectTimeline, RiskLevel, TimelineEntry } from './types.js';
import { runGit } from '../scanner/runGit.js';
import { readProjectTimeline } from './store.js';

function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

function graphRef(kind: string, name: string): string {
  return `${kind}:${name}`;
}

function riskFromChangeCount(n: number): RiskLevel {
  if (n >= 4) {
    return 'high';
  }
  if (n >= 2) {
    return 'medium';
  }
  return 'low';
}

interface GitCommitRow {
  hash: string;
  timestamp: number;
  type: TimelineEntry['type'];
  file: string;
}

async function recentGitCommits(workspaceRoot: string, max = 5): Promise<GitCommitRow[]> {
  try {
    const stdout = await runGit(
      workspaceRoot,
      ['log', `-${max}`, '--pretty=format:---%n%H|%ct', '--name-status'],
    );
    const rows: GitCommitRow[] = [];
    let current: { hash: string; timestamp: number } | undefined;
    for (const line of stdout.split('\n')) {
      if (line === '---') {
        current = undefined;
        continue;
      }
      const header = line.match(/^([0-9a-f]{7,40})\|(\d+)$/);
      if (header) {
        current = { hash: header[1]!, timestamp: Number(header[2]!) * 1000 };
        continue;
      }
      if (!current || line.length < 2) {
        continue;
      }
      const status = line[0]!;
      const file = norm(line.slice(1).trim().split('\t').pop() ?? line.slice(2).trim());
      if (!file) {
        continue;
      }
      let type: TimelineEntry['type'] = 'modify';
      if (status === 'A') {
        type = 'add';
      } else if (status === 'D') {
        type = 'delete';
      } else if (status === 'R') {
        type = 'rename';
      }
      rows.push({ hash: current.hash, timestamp: current.timestamp, type, file });
    }
    return rows;
  } catch {
    return [];
  }
}

function keyChangesForFile(change: ChangeArtifact, file: string): KeyChange[] {
  return change.key_changes.filter(
    (k) => (k.kind === 'file' && k.symbol === file) || k.symbol.startsWith(`${file}::`),
  );
}

function linkedNodes(graph: ProjectGraph, file: string, keyChanges: KeyChange[]): string[] {
  const names = new Set(keyChanges.map((k) => k.symbol.split('::').pop() ?? k.symbol));
  const refs: string[] = [];
  for (const n of graph.nodes) {
    if (n.file !== file) {
      continue;
    }
    if (names.has(n.name)) {
      refs.push(graphRef(n.kind, n.name));
    }
  }
  return refs.slice(0, 8);
}

export interface BuildProjectTimelineOptions {
  skipGitLog?: boolean;
}

export async function buildProjectTimeline(
  workspaceRoot: string,
  changedFiles: string[],
  change: ChangeArtifact,
  graph: ProjectGraph,
  now = Date.now(),
  maxCommits = 5,
  opts?: BuildProjectTimelineOptions,
): Promise<ProjectTimeline> {
  if (opts?.skipGitLog) {
    const cached = await readProjectTimeline(workspaceRoot);
    if (cached) {
      return cached;
    }
    return {
      version: 1,
      generatedAt: now,
      files: [],
      recent: [],
    };
  }

  const commits = await recentGitCommits(workspaceRoot, maxCommits);
  const watch = new Set(changedFiles.map(norm));
  const byFile = new Map<string, TimelineEntry[]>();

  for (const row of commits) {
    if (!watch.has(row.file) && !changedFiles.some((f) => row.file.startsWith(f))) {
      continue;
    }
    const kc = keyChangesForFile(change, row.file);
    const entry: TimelineEntry = {
      commit: row.hash.slice(0, 7),
      timestamp: row.timestamp,
      type: row.type,
      file: row.file,
      changes: kc.map((k) => ({
        symbol: k.symbol.split('::').pop() ?? k.symbol,
        change: k.change_type === 'added' ? 'symbol_added' : 'logic_modified',
      })),
      impact_level: riskFromChangeCount(kc.length),
      linked_graph_nodes: linkedNodes(graph, row.file, kc),
    };
    const list = byFile.get(row.file) ?? [];
    list.push(entry);
    byFile.set(row.file, list);
  }

  const files = [...byFile.entries()].map(([file, history]) => ({ file, history }));

  const recent = commits
    .filter((r) => watch.has(r.file))
    .slice(0, maxCommits)
    .map((row) => {
      const kc = keyChangesForFile(change, row.file);
      return {
        commit: row.hash.slice(0, 7),
        timestamp: row.timestamp,
        type: row.type,
        file: row.file,
        changes: kc.map((k) => ({
          symbol: k.symbol.split('::').pop() ?? k.symbol,
          change: k.change_type === 'added' ? 'symbol_added' : 'logic_modified',
        })),
        impact_level: riskFromChangeCount(kc.length),
        linked_graph_nodes: linkedNodes(graph, row.file, kc),
      } satisfies TimelineEntry;
    });

  return {
    version: 1,
    generatedAt: now,
    files,
    recent,
  };
}
