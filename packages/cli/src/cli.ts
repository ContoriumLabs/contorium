#!/usr/bin/env node
import * as path from 'node:path';
import {
  buildUnderstandingExportJson,
  filterMappingsByConfidence,
  formatCanonicalAiMarkdown,
  formatHandoffMarkdown,
  readChangeArtifact,
  readHandoffArtifact,
  readKnowledgeSnapshot,
  readProjectGraph,
  readProjectKnowledgeGraph,
  readProjectSnapshotMarkdown,
  readProjectTimeline,
  readStateJson,
  readWorkspaceStatus,
  syncWorkspaceState,
} from '@contora/state-core';

const USAGE = `Contorium CLI — runtime adapter (same state-core as IDE / MCP)

Usage:
  contorium init [workspaceRoot]       Bootstrap or merge .contora/state.json
  contorium sync [workspaceRoot]       Rescan workspace and refresh state (one-shot)
  contorium snapshot [workspaceRoot]   Print PROJECT SNAPSHOT markdown
  contorium status [workspaceRoot]     JSON summary (mode, source, git counts)
  contorium state [workspaceRoot]      Print state.json (pretty JSON)

V3.1 understanding (mirrors MCP get_project_*):
  contorium handoff [path] [--format json|markdown]   AI handoff (recommended entry)
  contorium change [path]                             change.json
  contorium graph [path]                              graph.json (change neighborhood)
  contorium timeline [path]                           timeline.json
  contorium knowledge [path] [--min-confidence N]     knowledge graph (default filter 0.7)
  contorium graph-snapshot [path]                     cognitive snapshot (compact)
  contorium export [path] [--format json|markdown]    canonical AI export (V3.1)

Default workspaceRoot: current directory
`;

function workspaceArg(index = 3): string {
  const args = process.argv.slice(3).filter((a) => !a.startsWith('--'));
  const arg = args[0];
  return path.resolve(arg || process.cwd());
}

function flagValue(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) {
    return process.argv[i + 1]!;
  }
  return fallback;
}

function flagNumber(name: string): number | undefined {
  const raw = flagValue(name, '');
  if (!raw) {
    return undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function basenameOf(rel: string): string {
  const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : rel;
}

async function ensureUnderstanding(root: string): Promise<void> {
  await syncWorkspaceState(root, 'cli', { forceArtifacts: true });
}

async function printJson(data: unknown): Promise<void> {
  console.log(JSON.stringify(data, null, 2));
}

async function cmdInit(root: string): Promise<void> {
  const result = await syncWorkspaceState(root, 'cli', { forceArtifacts: true });
  console.log(JSON.stringify({ workspaceRoot: root, ...result }, null, 2));
}

async function cmdSync(root: string): Promise<void> {
  const result = await syncWorkspaceState(root, 'cli');
  console.log(JSON.stringify({ workspaceRoot: root, ...result }, null, 2));
}

async function cmdSnapshot(root: string): Promise<void> {
  const existing = await readProjectSnapshotMarkdown(root);
  if (existing) {
    process.stdout.write(existing.endsWith('\n') ? existing : `${existing}\n`);
    return;
  }
  await ensureUnderstanding(root);
  const md = await readProjectSnapshotMarkdown(root);
  process.stdout.write(md ?? '');
}

async function cmdStatus(root: string): Promise<void> {
  const status = await readWorkspaceStatus(root);
  console.log(JSON.stringify(status, null, 2));
}

async function cmdState(root: string): Promise<void> {
  const state = await readStateJson(root);
  if (!state) {
    console.error('contorium state: no .contora/state.json — run: contorium init');
    process.exit(1);
  }
  console.log(JSON.stringify(state, null, 2));
}

async function cmdHandoff(root: string): Promise<void> {
  let handoff = await readHandoffArtifact(root);
  if (!handoff) {
    await ensureUnderstanding(root);
    handoff = await readHandoffArtifact(root);
  }
  if (!handoff) {
    console.error('contorium handoff: not generated — no recent code changes detected');
    process.exit(1);
  }
  const format = flagValue('--format', 'json');
  if (format === 'markdown' || format === 'md') {
    const timeline = await readProjectTimeline(root);
    process.stdout.write(formatHandoffMarkdown(handoff, timeline));
    return;
  }
  await printJson({ workspaceRoot: root, found: true, handoff });
}

async function cmdChange(root: string): Promise<void> {
  let change = await readChangeArtifact(root);
  if (!change) {
    await ensureUnderstanding(root);
    change = await readChangeArtifact(root);
  }
  if (!change) {
    console.error('contorium change: not generated');
    process.exit(1);
  }
  await printJson({ workspaceRoot: root, found: true, change });
}

async function cmdGraph(root: string): Promise<void> {
  let graph = await readProjectGraph(root);
  if (!graph) {
    await ensureUnderstanding(root);
    graph = await readProjectGraph(root);
  }
  if (!graph) {
    console.error('contorium graph: not generated');
    process.exit(1);
  }
  await printJson({ workspaceRoot: root, found: true, graph });
}

async function cmdTimeline(root: string): Promise<void> {
  let timeline = await readProjectTimeline(root);
  if (!timeline) {
    await ensureUnderstanding(root);
    timeline = await readProjectTimeline(root);
  }
  if (!timeline) {
    console.error('contorium timeline: not generated — requires git history');
    process.exit(1);
  }
  await printJson({ workspaceRoot: root, found: true, timeline });
}

async function cmdKnowledge(root: string): Promise<void> {
  let knowledge = await readProjectKnowledgeGraph(root);
  if (!knowledge) {
    await ensureUnderstanding(root);
    knowledge = await readProjectKnowledgeGraph(root);
  }
  if (!knowledge) {
    console.error('contorium knowledge: not generated — save code changes or run sync');
    process.exit(1);
  }
  const threshold = flagNumber('--min-confidence') ?? 0.7;
  const { inferenceMappings, ...canonical } = knowledge;
  const payload = {
    ...canonical,
    intentMappings: filterMappingsByConfidence(knowledge.intentMappings, threshold),
  };
  await printJson({ workspaceRoot: root, found: true, knowledge: payload });
}

async function cmdGraphSnapshot(root: string): Promise<void> {
  let snapshot = await readKnowledgeSnapshot(root);
  if (!snapshot) {
    await ensureUnderstanding(root);
    snapshot = await readKnowledgeSnapshot(root);
  }
  if (!snapshot) {
    console.error('contorium graph-snapshot: not generated');
    process.exit(1);
  }
  await printJson({ workspaceRoot: root, found: true, snapshot });
}

async function cmdExport(root: string): Promise<void> {
  await ensureUnderstanding(root);
  const format = flagValue('--format', 'markdown');
  const [snapshot, handoff, timeline, state, knowledgeSnapshot] = await Promise.all([
    readProjectSnapshotMarkdown(root),
    readHandoffArtifact(root),
    readProjectTimeline(root),
    readStateJson(root),
    readKnowledgeSnapshot(root),
  ]);

  if (format === 'json') {
    const taskAnchor = state?.currentTask?.trim() || '';
    if (!handoff) {
      console.error('contorium export: handoff not generated');
      process.exit(1);
    }
    await printJson({
      taskAnchor: taskAnchor || '(not set)',
      ...buildUnderstandingExportJson({
        handoff,
        timeline,
        projectSnapshot: snapshot,
        knowledgeSnapshot: knowledgeSnapshot ?? undefined,
      }),
    });
    return;
  }

  const activeFiles = (state?.openFiles ?? []).map(basenameOf).slice(0, 8);
  const gitFiles = [...(state?.gitStaged ?? []), ...(state?.gitWorking ?? [])].map(basenameOf).slice(0, 8);

  process.stdout.write(
    formatCanonicalAiMarkdown({
      taskAnchor: state?.currentTask?.trim() || '(not set)',
      snapshotMarkdown: snapshot,
      activeFiles: activeFiles.length ? activeFiles : ['(none)'],
      recentGitActivity: gitFiles.length ? gitFiles : ['(none)'],
      handoff,
      timeline,
      knowledgeSnapshot,
      instruction: 'Continue from the current handoff and workspace state.',
      notes: state?.notes?.trim() || undefined,
    }),
  );
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  const root = workspaceArg();
  switch (cmd) {
    case 'init':
      await cmdInit(root);
      return;
    case 'sync':
      await cmdSync(root);
      return;
    case 'snapshot':
      await cmdSnapshot(root);
      return;
    case 'status':
      await cmdStatus(root);
      return;
    case 'state':
      await cmdState(root);
      return;
    case 'handoff':
      await cmdHandoff(root);
      return;
    case 'change':
      await cmdChange(root);
      return;
    case 'graph':
      await cmdGraph(root);
      return;
    case 'timeline':
      await cmdTimeline(root);
      return;
    case 'knowledge':
      await cmdKnowledge(root);
      return;
    case 'graph-snapshot':
      await cmdGraphSnapshot(root);
      return;
    case 'export':
      await cmdExport(root);
      return;
    default:
      process.stderr.write(USAGE);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('contorium:', err);
  process.exit(1);
});
