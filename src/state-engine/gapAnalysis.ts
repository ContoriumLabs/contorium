import type { StateSummary } from '../intelligence/types';
import {
  domainFromProblemArea,
  stageLabelForDomain,
  taskLabelForDomain,
} from '../intelligence/domainLabels';
import { stripSourceSuffix } from '../state-engine/sourcing';

function dedupe(items: readonly string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (t.length < 6) {
      continue;
    }
    const k = t.toLowerCase();
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(t);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

const DOMAIN_ACTIONS: Record<string, string> = {
  tests: 'add or update tests for recent changes',
  docs: 'continue documentation updates',
  mcp: 'verify MCP tools against workspace',
  'state-engine': 'review state persistence paths',
  ui: 'align UI with underlying changes',
  auth: 'fix authentication/session flows',
  build: 'run build verification',
  ai: 'review AI integration changes',
  git: 'review and commit pending changes',
};

function actionForDomain(domain: string): string | undefined {
  return DOMAIN_ACTIONS[domain];
}

function problemToAction(problem: string, domains: readonly string[]): string | undefined {
  const p = stripSourceSuffix(problem).trim();
  if (!p) {
    return undefined;
  }
  if (/uncommitted|integration risk/i.test(p)) {
    return 'review and commit pending changes';
  }

  const fromArea = domainFromProblemArea(p);
  if (fromArea) {
    return actionForDomain(fromArea);
  }

  const workIn = p.match(/active work in\s+(.+?)(?:\s+module)?$/i);
  if (workIn?.[1]) {
    const area = workIn[1].trim().toLowerCase();
    if (/\u6587\u6863|documentation/.test(area)) {
      return 'continue documentation updates';
    }
    if (/auth|authentication|session/.test(area)) {
      return 'fix authentication/session flows';
    }
    for (const d of domains) {
      const label = taskLabelForDomain(d).toLowerCase();
      if (area.includes(label) || label.includes(area)) {
        return actionForDomain(d);
      }
    }
  }

  if (/exploring|undirected|light or/i.test(p)) {
    return undefined;
  }
  return undefined;
}

/**
 * L4 next actions — short imperative verbs only (no vague areas like "project root").
 */
export function deriveNextActionsFromGaps(args: {
  summary: StateSummary;
  openProblems: readonly string[];
  activeModules: readonly string[];
  topFilePaths: readonly string[];
}): string[] {
  const out: string[] = [];
  const domains = args.summary.active_domains;

  for (const p of args.openProblems.slice(0, 2)) {
    const action = problemToAction(p, domains);
    if (action) {
      out.push(action);
    }
  }

  for (const d of domains.slice(0, 3)) {
    const gap = actionForDomain(d);
    if (gap) {
      out.push(gap);
    }
  }

  if (!out.length && domains.length) {
    for (const d of domains.slice(0, 2)) {
      const gap = actionForDomain(d);
      if (gap) {
        out.push(gap);
      }
    }
  }

  return dedupe(out, 4);
}

/** Used by export purifier when snapshot still contains legacy vague goal lines. */
export function refineVagueGoalLine(goalBody: string, domains: readonly string[]): string {
  const g = goalBody.trim();
  if (!g) {
    return g;
  }
  if (/project\s*root|workspace work centered|developing\s+(project|repo|src)/i.test(g)) {
    if (domains.length) {
      const labels = domains.slice(0, 2).map(taskLabelForDomain);
      if (labels.length >= 2) {
        return `develop ${labels[0]} and ${labels[1]}`;
      }
      return `develop ${labels[0]}`;
    }
  }
  return g.replace(/^developing\s+/i, 'develop ').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function refineVagueStageLine(stageBody: string, domains: readonly string[]): string {
  const s = stageBody.trim();
  if (!s) {
    return s;
  }
  if (/project\s*root|Active development ·/i.test(s) || /\bwork ·\b/.test(s)) {
    if (domains.length >= 2) {
      return `${domains.slice(0, 2).map(stageLabelForDomain).join(' + ')} development`;
    }
    if (domains.length === 1) {
      return `${stageLabelForDomain(domains[0]!)} development`;
    }
  }
  return s;
}
