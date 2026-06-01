import {
  deriveTaskOrientedGoal,
  deriveTaskOrientedProblem,
  isVagueCluster,
  taskLabelForDomain,
} from './domainLabels';

const DOMAIN_RULES: ReadonlyArray<{ domain: string; pattern: RegExp }> = [
  { domain: 'auth', pattern: /auth|login|session|token|oauth|jwt/i },
  { domain: 'state-engine', pattern: /state|store|persist|lifecycle|memory/i },
  { domain: 'ui', pattern: /ui|sidebar|webview|component|view/i },
  { domain: 'mcp', pattern: /mcp|agent|tool/i },
  { domain: 'ai', pattern: /ai|llm|intent|prompt|byok|semantic/i },
  { domain: 'tests', pattern: /test|spec|__tests__|\.test\./i },
  { domain: 'docs', pattern: /docs?|readme|\.md$/i },
  { domain: 'build', pattern: /package\.json|tsconfig|webpack|vite|scripts\//i },
  { domain: 'git', pattern: /git|\.gitignore/i },
];

export function inferDomainsFromPaths(paths: readonly string[]): string[] {
  const scores = new Map<string, number>();
  for (const p of paths) {
    const norm = p.replace(/\\/g, '/');
    for (const { domain, pattern } of DOMAIN_RULES) {
      if (pattern.test(norm)) {
        scores.set(domain, (scores.get(domain) ?? 0) + 1);
      }
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([d]) => d);
}

export function inferProblemArea(
  domains: readonly string[],
  gitPaths: readonly string[],
  topCluster: string | undefined,
): string {
  if (gitPaths.length >= 4) {
    const label = domains[0] ? taskLabelForDomain(domains[0]) : undefined;
    return label
      ? `uncommitted changes in ${label} module`
      : 'broad uncommitted workspace changes';
  }
  const domainProblem = deriveTaskOrientedProblem(domains);
  if (domainProblem) {
    return domainProblem;
  }
  if (topCluster && !isVagueCluster(topCluster)) {
    return `active work in ${topCluster}`;
  }
  return 'light or undirected activity';
}

/** Event-derived, task-oriented goal (domains only — no vague cluster paths). */
export function deriveProjectIntent(
  _topCluster: string | undefined,
  domains: readonly string[],
): string {
  return deriveTaskOrientedGoal(domains);
}

/** Auxiliary L5 hints only — not used in L4 snapshot next_actions. */
export function suggestInferredBehaviorHints(
  domains: readonly string[],
  topFiles: readonly string[],
): string[] {
  const out: string[] = [];
  for (const d of domains.slice(0, 2)) {
    if (d === 'tests') {
      out.push('add or update tests for recent changes');
    } else if (d === 'docs') {
      out.push('update documentation for recent changes');
    } else if (d === 'mcp') {
      out.push('verify MCP tools against workspace state');
    } else if (d === 'state-engine') {
      out.push('review state persistence and lifecycle logic');
    } else {
      out.push(`refine ${d} module changes`);
    }
  }
  for (const f of topFiles.slice(0, 2)) {
    const base = f.split('/').pop() ?? f;
    out.push(`iterate on ${base}`);
  }
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = x.toLowerCase();
    if (seen.has(k)) {
      return false;
    }
    seen.add(k);
    return true;
  }).slice(0, 5);
}
