/** Task-oriented domain labels — avoid vague cluster names like "project root". */

export const VAGUE_CLUSTER =
  /^(project\s*root|repo\s*root|workspace\s*root|root|src|lib|dist|build|out|\.|\.\.?|unknown|misc|other)$/i;

export const DOMAIN_TASK_LABEL: Record<string, string> = {
  docs: 'documentation',
  auth: 'authentication system',
  ui: 'UI layer',
  mcp: 'MCP integration',
  ai: 'AI integration',
  tests: 'test coverage',
  build: 'build tooling',
  'state-engine': 'state engine',
  git: 'git workflow',
};

export const DOMAIN_STAGE_LABEL: Record<string, string> = {
  docs: 'documentation',
  auth: 'authentication',
  ui: 'UI',
  mcp: 'MCP integration',
  ai: 'AI layer',
  tests: 'testing',
  build: 'build',
  'state-engine': 'state engine',
  git: 'git',
};

export function isVagueCluster(cluster: string | undefined): boolean {
  if (!cluster?.trim()) {
    return true;
  }
  const c = cluster.trim();
  if (VAGUE_CLUSTER.test(c)) {
    return true;
  }
  if (c.length <= 2) {
    return true;
  }
  return false;
}

export function taskLabelForDomain(domain: string): string {
  return DOMAIN_TASK_LABEL[domain] ?? domain.replace(/-/g, ' ');
}

export function stageLabelForDomain(domain: string): string {
  return DOMAIN_STAGE_LABEL[domain] ?? domain.replace(/-/g, ' ');
}

/** Task-oriented goal from domains only (no filesystem cluster names). */
export function deriveTaskOrientedGoal(domains: readonly string[]): string {
  const labels = domains.slice(0, 3).map(taskLabelForDomain).filter(Boolean);
  if (labels.length >= 2) {
    const head = labels.slice(0, -1).join(', ');
    const tail = labels[labels.length - 1]!;
    return `develop ${head} and ${tail}`;
  }
  if (labels.length === 1) {
    return `develop ${labels[0]!}`;
  }
  return 'ongoing workspace development';
}

/** e.g. "documentation + authentication development" */
export function deriveTaskOrientedStage(domains: readonly string[]): string {
  const labels = domains.slice(0, 2).map(stageLabelForDomain);
  if (labels.length >= 2) {
    return `${labels.join(' + ')} development`;
  }
  if (labels.length === 1) {
    return `${labels[0]} development`;
  }
  return 'exploration / setup';
}

/** Module-scoped problem line (no vague cluster paths). */
export function deriveTaskOrientedProblem(domains: readonly string[]): string | undefined {
  const primary = domains[0];
  if (!primary) {
    return undefined;
  }
  const label = taskLabelForDomain(primary);
  return `active work in ${label} module`;
}

export function domainFromProblemArea(area: string): string | undefined {
  const p = area.trim().toLowerCase();
  if (/\u6587\u6863|documentation|\bdocs\b/.test(p)) {
    return 'docs';
  }
  if (/auth|authentication|session|login/.test(p)) {
    return 'auth';
  }
  if (/test/.test(p)) {
    return 'tests';
  }
  if (/build|toolchain/.test(p)) {
    return 'build';
  }
  if (/ui|interface/.test(p)) {
    return 'ui';
  }
  return undefined;
}
