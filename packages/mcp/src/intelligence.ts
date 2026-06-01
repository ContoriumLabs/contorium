import * as fs from 'node:fs/promises';
import { stateSummaryFile } from './paths.js';

export interface McpStateSummary {
  version: number;
  generatedAt: number;
  project_intent: string;
  current_focus: string;
  active_domains: string[];
  active_problem_area: string;
  activity_clusters: Array<{ cluster: string; files: string[]; weight: number }>;
  next_likely_actions: string[];
  confidence: number;
}

export async function loadProjectIntelligence(workspaceRoot: string): Promise<McpStateSummary | null> {
  const fp = stateSummaryFile(workspaceRoot);
  try {
    const text = await fs.readFile(fp, 'utf8');
    const o = JSON.parse(text) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || o.version !== 1) {
      return null;
    }
    return {
      version: 1,
      generatedAt: typeof o.generatedAt === 'number' ? o.generatedAt : 0,
      project_intent: typeof o.project_intent === 'string' ? o.project_intent : '',
      current_focus: typeof o.current_focus === 'string' ? o.current_focus : '',
      active_domains: Array.isArray(o.active_domains)
        ? o.active_domains.filter((x): x is string => typeof x === 'string')
        : [],
      active_problem_area: typeof o.active_problem_area === 'string' ? o.active_problem_area : '',
      activity_clusters: Array.isArray(o.activity_clusters)
        ? o.activity_clusters
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map((c) => ({
              cluster: typeof c.cluster === 'string' ? c.cluster : '',
              files: Array.isArray(c.files) ? c.files.filter((f): f is string => typeof f === 'string') : [],
              weight: typeof c.weight === 'number' ? c.weight : 0,
            }))
        : [],
      next_likely_actions: Array.isArray(o.next_likely_actions)
        ? o.next_likely_actions.filter((x): x is string => typeof x === 'string')
        : [],
      confidence: typeof o.confidence === 'number' ? o.confidence : 0,
    };
  } catch {
    return null;
  }
}
