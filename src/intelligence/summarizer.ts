import type { WorkspaceEvent } from '../core/models/events';
import type { ProjectState } from '../types/state';
import { clusterFilesByDirectory, rankedFileScores } from './analyzer';
import {
  deriveProjectIntent,
  inferDomainsFromPaths,
  inferProblemArea,
  suggestInferredBehaviorHints,
} from './heuristics';
import { emptyStateSummary, type StateSummary } from './types';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Read-only: derive semantic project understanding from state + events. */
export function buildStateSummary(
  state: ProjectState,
  events: readonly WorkspaceEvent[],
  now = Date.now(),
): StateSummary {
  const ranked = rankedFileScores(events, state, now);
  const clusters = clusterFilesByDirectory(ranked);
  const topCluster = clusters[0]?.cluster;
  const pathSample = ranked.slice(0, 24).map((r) => r.path);
  const domains = inferDomainsFromPaths([
    ...pathSample,
    ...(state.openFiles ?? []),
    ...(state.gitWorking ?? []),
    ...(state.gitStaged ?? []),
  ]);
  const gitPaths = [...new Set([...(state.gitWorking ?? []), ...(state.gitStaged ?? [])])];
  const activitySignal = ranked.length ? Math.min(1, ranked[0]!.score) : 0;
  const gitSignal = gitPaths.length ? Math.min(0.25, gitPaths.length * 0.04) : 0;
  const clusterSignal = clusters[0]?.weight ?? 0;
  const confidence = clamp01(activitySignal * 0.55 + clusterSignal * 0.3 + gitSignal);

  return {
    ...emptyStateSummary(now),
    project_intent: deriveProjectIntent(topCluster, domains),
    current_focus: topCluster ? `work in ${topCluster}` : 'undirected exploration',
    active_domains: domains,
    active_problem_area: inferProblemArea(domains, gitPaths, topCluster),
    activity_clusters: clusters.map((c) => ({
      cluster: c.cluster,
      files: c.files,
      weight: Math.round(c.weight * 100) / 100,
    })),
    next_likely_actions: suggestInferredBehaviorHints(domains, ranked.map((r) => r.path)),
    confidence: Math.round(confidence * 100) / 100,
  };
}
