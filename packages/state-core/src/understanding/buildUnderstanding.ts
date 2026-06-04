import type { BootstrapStateJson, WorkspaceScanFacts } from '../types.js';
import type { ProjectBuiltState } from '../state-builder/types.js';
import { readProjectBuiltState } from '../state-builder/store.js';
import { readStateJson } from '../bootstrap/bootstrapState.js';
import { resolveChangedFiles } from './changeDetector.js';
import { buildChangeNeighborhoodGraph, deriveChangeArtifact } from './graphBuilder.js';
import { analyzeImpact } from './impactAnalyzer.js';
import { fuseIntent } from './intentFusion.js';
import { buildHandoff } from './handoffBuilder.js';
import { buildProjectTimeline } from './timelineTracker.js';
import { buildGitFrequency } from './knowledgeGraph/gitFrequency.js';
import { buildProjectKnowledgeGraph } from './knowledgeGraph/knowledgeGraphBuilder.js';
import type { ProjectKnowledgeGraph } from './knowledgeGraph/types.js';
import { writeProjectKnowledgeGraph, readProjectKnowledgeGraph } from './knowledgeGraph/store.js';
import { resolveKnowledgeRebuildTrigger } from './knowledgeGraph/rebuildTrigger.js';
import { writeUnderstandingArtifacts } from './store.js';
import { getContoriumPackageVersion } from '../version.js';
import type { ChangeArtifact, HandoffArtifact, ProjectGraph, ProjectTimeline } from './types.js';

export interface UnderstandingBuildInput {
  workspaceRoot: string;
  state?: BootstrapStateJson;
  built?: ProjectBuiltState | null;
  scan?: WorkspaceScanFacts;
  extraChangedPaths?: string[];
}

export interface UnderstandingBuildResult {
  graph: ProjectGraph;
  change: ChangeArtifact;
  handoff: HandoffArtifact;
  timeline: ProjectTimeline;
  knowledge: ProjectKnowledgeGraph;
}

export async function buildUnderstandingArtifacts(
  input: UnderstandingBuildInput,
): Promise<UnderstandingBuildResult | undefined> {
  const root = input.workspaceRoot;
  const state = input.state ?? (await readStateJson(root));
  if (!state) {
    return undefined;
  }

  const changedFiles = await resolveChangedFiles(
    root,
    state,
    input.scan,
    input.extraChangedPaths ?? [],
  );
  if (!changedFiles.length) {
    return undefined;
  }

  const now = Date.now();
  const built = input.built ?? (await readProjectBuiltState(root));
  const { graph, extractions } = await buildChangeNeighborhoodGraph(root, changedFiles, now);
  const change = deriveChangeArtifact(changedFiles, extractions, now);
  const impact = analyzeImpact(graph, change);
  const intent = fuseIntent({ state, change, built });
  const goal = built?.project_goal?.trim() || state.currentTask.trim();
  const handoff = buildHandoff({ goal, intent, change, impact, graph, built, now });
  const timeline = await buildProjectTimeline(root, changedFiles, change, graph, now);

  const editCounts = new Map<string, number>();
  for (const p of [...changedFiles, ...(input.extraChangedPaths ?? [])]) {
    const k = p.replace(/\\/g, '/');
    editCounts.set(k, (editCounts.get(k) ?? 0) + 1);
  }
  const gitFrequency = buildGitFrequency(timeline, state);
  const existing = await readProjectKnowledgeGraph(root);
  const latestCommit = timeline.recent[0]?.commit;
  const rebuildTrigger = resolveKnowledgeRebuildTrigger({
    changedFileCount: changedFiles.length,
    intentChanged: goal !== (existing?.nodes.find((n) => n.type === 'intent')?.name ?? ''),
    lastBuildAt: existing?.meta.generatedAt,
    now,
    hasNewCommit: !!latestCommit && latestCommit !== existing?.meta.lastCommitHash,
    isInitial: !existing,
  });
  const knowledge = buildProjectKnowledgeGraph({
    graph,
    change,
    intent,
    built,
    goal,
    workspaceRoot: root,
    sourceVersion: getContoriumPackageVersion(),
    now,
    editCounts,
    gitFrequency,
    rebuildTrigger,
    lastCommitHash: latestCommit,
  });

  return { graph, change, handoff, timeline, knowledge };
}

/** Build and persist V3.1 understanding artifacts (graph + change + handoff + timeline). */
export async function buildAndWriteUnderstandingArtifacts(
  input: UnderstandingBuildInput,
): Promise<UnderstandingBuildResult | undefined> {
  const result = await buildUnderstandingArtifacts(input);
  if (!result) {
    return undefined;
  }
  await writeUnderstandingArtifacts(input.workspaceRoot, result);
  await writeProjectKnowledgeGraph(input.workspaceRoot, result.knowledge);
  return result;
}
