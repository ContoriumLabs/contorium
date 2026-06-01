/** v0.7 Context Intelligence Layer — derived output schema (`.contora/intelligence/state-summary.json`). */

export interface ActivityCluster {
  cluster: string;
  files: string[];
  weight: number;
}

export interface StateSummary {
  version: 1;
  generatedAt: number;
  project_intent: string;
  current_focus: string;
  active_domains: string[];
  active_problem_area: string;
  activity_clusters: ActivityCluster[];
  next_likely_actions: string[];
  confidence: number;
}

export const STATE_SUMMARY_VERSION = 1 as const;

export function emptyStateSummary(now = Date.now()): StateSummary {
  return {
    version: STATE_SUMMARY_VERSION,
    generatedAt: now,
    project_intent: '',
    current_focus: '',
    active_domains: [],
    active_problem_area: '',
    activity_clusters: [],
    next_likely_actions: [],
    confidence: 0,
  };
}
