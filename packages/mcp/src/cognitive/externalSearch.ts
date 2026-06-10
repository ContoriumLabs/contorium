import type { RankedCandidate, SkillSource } from './types.js';

export interface ExternalSearchHit {
  name: string;
  description: string;
  link: string;
  source: SkillSource;
  tags: string[];
  popularity: number;
  recency: number;
}

const SEARCH_TIMEOUT_MS = 8_000;

async function fetchJson<T>(url: string): Promise<T | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'contorium-mcp/1.0' },
    });
    if (!res.ok) {
      return undefined;
    }
    return (await res.json()) as T;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchGitHub(keywords: string[], limit = 6): Promise<ExternalSearchHit[]> {
  const q = encodeURIComponent(keywords.slice(0, 6).join(' '));
  const data = await fetchJson<{
    items?: Array<{
      full_name: string;
      html_url: string;
      description?: string;
      stargazers_count?: number;
      updated_at?: string;
      topics?: string[];
    }>;
  }>(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${limit}`);

  if (!data?.items?.length) {
    return [];
  }

  const now = Date.now();
  return data.items.map((item) => {
    const updated = item.updated_at ? Date.parse(item.updated_at) : now;
    const ageDays = Math.max(1, (now - updated) / 86_400_000);
    const recency = Math.min(1, 30 / ageDays);
    const popularity = Math.min(1, (item.stargazers_count ?? 0) / 5000);
    return {
      name: item.full_name,
      description: item.description ?? 'GitHub repository',
      link: item.html_url,
      source: 'github' as const,
      tags: item.topics ?? [],
      popularity,
      recency,
    };
  });
}

export async function searchNpm(keywords: string[], limit = 6): Promise<ExternalSearchHit[]> {
  const text = encodeURIComponent(keywords.slice(0, 6).join(' '));
  const data = await fetchJson<{
    objects?: Array<{
      package: { name: string; description?: string; links?: { npm?: string } };
      score?: { final?: number };
    }>;
  }>(`https://registry.npmjs.org/-/v1/search?text=${text}&size=${limit}`);

  if (!data?.objects?.length) {
    return [];
  }

  return data.objects.map((obj) => ({
    name: obj.package.name,
    description: obj.package.description ?? 'npm package',
    link: obj.package.links?.npm ?? `https://www.npmjs.com/package/${obj.package.name}`,
    source: 'npm' as const,
    tags: ['npm'],
    popularity: Math.min(1, (obj.score?.final ?? 0) / 1),
    recency: 0.7,
  }));
}

export function rankCandidates(
  items: Array<{
    name: string;
    description?: string;
    source: SkillSource;
    link: string;
    tags: string[];
    keyword_match: number;
    popularity: number;
    recency: number;
    reason: string;
  }>,
  limit = 10,
): RankedCandidate[] {
  return items
    .map((item) => ({
      ...item,
      score: item.keyword_match * 0.6 + item.popularity * 0.2 + item.recency * 0.2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
