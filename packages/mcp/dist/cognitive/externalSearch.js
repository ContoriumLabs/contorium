const SEARCH_TIMEOUT_MS = 8_000;
async function fetchJson(url) {
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
        return (await res.json());
    }
    catch {
        return undefined;
    }
    finally {
        clearTimeout(timer);
    }
}
export async function searchGitHub(keywords, limit = 6) {
    const q = encodeURIComponent(keywords.slice(0, 6).join(' '));
    const data = await fetchJson(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${limit}`);
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
            source: 'github',
            tags: item.topics ?? [],
            popularity,
            recency,
        };
    });
}
export async function searchNpm(keywords, limit = 6) {
    const text = encodeURIComponent(keywords.slice(0, 6).join(' '));
    const data = await fetchJson(`https://registry.npmjs.org/-/v1/search?text=${text}&size=${limit}`);
    if (!data?.objects?.length) {
        return [];
    }
    return data.objects.map((obj) => ({
        name: obj.package.name,
        description: obj.package.description ?? 'npm package',
        link: obj.package.links?.npm ?? `https://www.npmjs.com/package/${obj.package.name}`,
        source: 'npm',
        tags: ['npm'],
        popularity: Math.min(1, (obj.score?.final ?? 0) / 1),
        recency: 0.7,
    }));
}
export function rankCandidates(items, limit = 10) {
    return items
        .map((item) => ({
        ...item,
        score: item.keyword_match * 0.6 + item.popularity * 0.2 + item.recency * 0.2,
    }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}
