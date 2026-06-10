import type { LocalSkillEntry } from './types.js';

/** Built-in local skill registry (V1). External index only — no execution. */
export const LOCAL_SKILL_REGISTRY: LocalSkillEntry[] = [
  {
    name: 'Auth Debugger',
    description: 'JWT, session, and login flow debugging patterns',
    tags: ['auth', 'jwt', 'login', 'security', 'session'],
    link: 'https://github.com/search?q=auth+jwt+debug',
  },
  {
    name: 'MCP Integration',
    description: 'Model Context Protocol server setup and handoff tools',
    tags: ['mcp', 'handoff', 'context', 'claude', 'codex', 'cursor'],
    link: 'https://modelcontextprotocol.io/',
  },
  {
    name: 'Git Workflow',
    description: 'Commit hygiene, diff review, and branch management',
    tags: ['git', 'commit', 'diff', 'branch', 'merge'],
  },
  {
    name: 'API Design',
    description: 'REST/GraphQL endpoint design and middleware patterns',
    tags: ['api', 'rest', 'graphql', 'middleware', 'backend'],
  },
  {
    name: 'Testing Patterns',
    description: 'Unit, integration, and e2e test scaffolding',
    tags: ['test', 'spec', 'jest', 'vitest', 'playwright'],
  },
  {
    name: 'Frontend UI',
    description: 'Component libraries, CSS, and landing page work',
    tags: ['frontend', 'react', 'vue', 'css', 'html', 'landing'],
  },
  {
    name: 'DevOps CI',
    description: 'CI/CD pipelines, Docker, and deployment scripts',
    tags: ['ci', 'docker', 'deploy', 'github-actions', 'devops'],
  },
  {
    name: 'Documentation',
    description: 'README, API docs, and technical writing',
    tags: ['docs', 'readme', 'markdown', 'documentation'],
  },
  {
    name: 'TypeScript Refactor',
    description: 'Type-safe refactors and module boundary cleanup',
    tags: ['typescript', 'refactor', 'types', 'module'],
  },
  {
    name: 'Security Review',
    description: 'Dependency audit and vulnerability scanning',
    tags: ['security', 'audit', 'vulnerability', 'npm', 'dependency'],
  },
];

export function searchLocalRegistry(keywords: string[], limit = 12): LocalSkillEntry[] {
  const scored = LOCAL_SKILL_REGISTRY.map((entry) => {
    const hay = `${entry.name} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase();
    let hits = 0;
    for (const kw of keywords) {
      if (hay.includes(kw.toLowerCase())) {
        hits += 1;
      }
    }
    return { entry, hits };
  })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  return scored.slice(0, limit).map((s) => s.entry);
}
