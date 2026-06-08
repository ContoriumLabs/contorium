import * as vscode from 'vscode';
import { existsSync } from 'node:fs';
import type { StateSummary } from '../intelligence/types';
import type { WorkspaceEvent } from '../core/models/events';
import type { ProjectState } from '../types/state';
import { rankedFileScores } from '../intelligence/analyzer';
import {
  detectStateConflicts,
  extractTaskAnchor,
  normalizeProjectBuiltState,
  writeConflictsArtifact,
  deleteConflictsArtifact,
} from '../state-engine';
import { buildProjectBuiltState, type McpMemoryHint } from './builder';
import { formatProjectSnapshotMarkdown } from './snapshot';
import { readProjectBuiltState, writeProjectBuiltState } from './store';
import { buildAndWriteUnderstandingArtifacts } from '@contora/state-core';
import type { BootstrapStateJson } from '@contora/state-core';

function toBootstrapState(state: ProjectState): BootstrapStateJson {
  return {
    sessionId: state.sessionId ?? '',
    currentTask: state.currentTask,
    openFiles: state.openFiles ?? [],
    recentFiles: state.recentFiles ?? [],
    gitStaged: state.gitStaged ?? [],
    gitWorking: state.gitWorking ?? [],
    notes: state.notes ?? '',
    lastUpdated: state.lastUpdated,
    source: state.source,
  };
}

async function readReadmeHint(folder: vscode.WorkspaceFolder): Promise<string | undefined> {
  for (const name of ['README.md', 'readme.md', 'Readme.md']) {
    try {
      const uri = vscode.Uri.joinPath(folder.uri, name);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf8');
      for (const line of text.split('\n')) {
        const t = line.replace(/^#+\s*/, '').trim();
        if (t.length >= 12 && !/^contorium|table of contents/i.test(t)) {
          return t.length > 160 ? t.slice(0, 157) + '…' : t;
        }
      }
    } catch {
      /* try next */
    }
  }
  return undefined;
}

async function readMcpHints(folder: vscode.WorkspaceFolder): Promise<McpMemoryHint> {
  const decisions: string[] = [];
  const architecture: string[] = [];
  const problems: string[] = [];
  try {
    const uri = vscode.Uri.joinPath(folder.uri, '.contora', 'mcp', 'memories.json');
    const bytes = await vscode.workspace.fs.readFile(uri);
    const parsed = JSON.parse(Buffer.from(bytes).toString('utf8')) as {
      entries?: Record<string, { value?: string; type?: string }>;
    };
    const entries = parsed?.entries ?? {};
    for (const entry of Object.values(entries)) {
      const v = (entry.value ?? '').trim();
      if (v.length < 4) {
        continue;
      }
      if (entry.type === 'decision') {
        decisions.push(v);
      } else if (entry.type === 'architecture') {
        architecture.push(v);
      } else if (/problem|block|error|issue|bug/i.test(v)) {
        problems.push(v);
      }
    }
  } catch {
    /* no mcp memories */
  }
  return { decisions, architecture, problems };
}

/** L2 → L3 → conflict audit → L4 snapshot (Intent graph excluded). */
export async function rebuildProjectStateArtifacts(args: {
  folder: vscode.WorkspaceFolder;
  state: ProjectState;
  events: readonly WorkspaceEvent[];
  summary: StateSummary;
  extraHotPaths?: string[];
}): Promise<void> {
  const previous = await readProjectBuiltState(args.folder);
  const [readmeHint, mcpHints] = await Promise.all([
    readReadmeHint(args.folder),
    readMcpHints(args.folder),
  ]);
  const taskAnchor = extractTaskAnchor(args.state);
  const now = Date.now();
  const ranked = rankedFileScores(args.events, args.state, now);

  const raw = buildProjectBuiltState({
    state: args.state,
    events: args.events,
    summary: args.summary,
    readmeHint,
    mcpHints,
    previous,
    now,
  });
  const built = normalizeProjectBuiltState(raw, taskAnchor);
  const withAnchor = { ...built, task_anchor: taskAnchor || undefined, engine_version: 2 };

  const conflicts = detectStateConflicts({
    normalized: withAnchor,
    mcpDecisions: mcpHints.decisions,
    mcpArchitecture: mcpHints.architecture,
    ideTopFiles: ranked.slice(0, 8).map((r) => r.path),
    now,
  });
  if (conflicts.length) {
    await writeConflictsArtifact(args.folder, conflicts, now);
  } else {
    await deleteConflictsArtifact(args.folder);
  }

  const md = formatProjectSnapshotMarkdown(withAnchor, conflicts);
  await writeProjectBuiltState(args.folder, withAnchor, md);

  await buildAndWriteUnderstandingArtifacts({
    workspaceRoot: args.folder.uri.fsPath,
    state: toBootstrapState(args.state),
    built: withAnchor,
    scan: {
      workspaceRoot: args.folder.uri.fsPath,
      scannedAt: now,
      topLevelModules: [],
      recentFiles: args.state.recentFiles ?? [],
      gitStaged: args.state.gitStaged ?? [],
      gitWorking: args.state.gitWorking ?? [],
      isGitRepo: existsSync(vscode.Uri.joinPath(args.folder.uri, '.git').fsPath),
    },
    extraChangedPaths: [
      ...ranked.slice(0, 12).map((r) => r.path),
      ...(args.extraHotPaths ?? []),
    ],
    skipGitTimeline: true,
  }).catch((err: unknown) => {
    console.error('[Contorium] understanding layer update failed:', err);
  });
}
