import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { buildWorkspaceContext } from './contextBuilder.js';
import { searchGitHub, searchNpm, rankCandidates } from './externalSearch.js';
import { generateKeywords, inferIntent } from './intentInference.js';
import { searchLocalRegistry } from './localSkillRegistry.js';
import { suggestModelPreset } from './modelPreset.js';
import { isCognitiveOverlayEnabled, readCognitiveMode } from './modeStore.js';
import type { CognitiveInsights, IntentInference, SkillSuggestion } from './types.js';
import type { WorkspaceContext } from './contextBuilder.js';

const INSIGHTS_FILE = 'cognitive-insights.json';
const CACHE_FILE = 'cognitive-search-cache.json';

function insightsPath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora', 'mcp', INSIGHTS_FILE);
}

function cachePath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora', 'mcp', CACHE_FILE);
}

function keywordMatchScore(name: string, description: string, tags: string[], keywords: string[]): number {
  const hay = `${name} ${description} ${tags.join(' ')}`.toLowerCase();
  if (!keywords.length) {
    return 0;
  }
  let hits = 0;
  for (const kw of keywords) {
    if (hay.includes(kw.toLowerCase())) {
      hits += 1;
    }
  }
  return Math.min(1, hits / Math.max(1, keywords.length));
}

function toSkillSuggestion(item: {
  name: string;
  reason: string;
  source: SkillSuggestion['source'];
  link: string;
  score: number;
  tags?: string[];
}): SkillSuggestion {
  return {
    name: item.name,
    reason: item.reason,
    source: item.source,
    link: item.link,
    score: Math.round(item.score * 100) / 100,
    tags: item.tags,
  };
}

async function readSearchCache(workspaceRoot: string): Promise<{ at: number; keywords: string[] } | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(cachePath(workspaceRoot), 'utf8')) as {
      at: number;
      keywords: string[];
    };
    if (Date.now() - raw.at < 15 * 60_000) {
      return raw;
    }
  } catch {
    /* miss */
  }
  return undefined;
}

async function writeSearchCache(workspaceRoot: string, keywords: string[]): Promise<void> {
  const fp = cachePath(workspaceRoot);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, `${JSON.stringify({ at: Date.now(), keywords }, null, 2)}\n`, 'utf8');
}

function nextStepHint(intent: IntentInference, ctx: WorkspaceContext): string {
  const pattern = intent.action_pattern ?? 'unknown';
  if (pattern === 'debug') {
    return 'Review recent changes and reproduce the failing path before editing more files';
  }
  if (pattern === 'refactor') {
    return 'Confirm impact graph coverage before renaming or moving modules';
  }
  if (ctx.changedFiles.length >= 5) {
    return 'High change velocity — consider syncing handoff before starting a new AI chat';
  }
  return `Continue ${intent.intent} — use get_project_handoff for runtime context`;
}

export async function readCognitiveInsights(workspaceRoot: string): Promise<CognitiveInsights | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(insightsPath(workspaceRoot), 'utf8')) as CognitiveInsights;
    if (raw.version === 1) {
      return raw;
    }
  } catch {
    /* miss */
  }
  return undefined;
}

export async function buildCognitiveInsights(
  workspaceRoot: string,
  opts?: { skipExternalSearch?: boolean },
): Promise<CognitiveInsights> {
  const modeState = await readCognitiveMode(workspaceRoot);
  const ctx = await buildWorkspaceContext(workspaceRoot);
  const intent = inferIntent(ctx);
  const keywords = generateKeywords(ctx, intent);
  const overlay = isCognitiveOverlayEnabled(modeState.mode);

  const base: CognitiveInsights = {
    version: 1,
    generatedAt: Date.now(),
    mode: modeState.mode,
    cognitive_overlay_enabled: overlay,
    detected_intent: intent,
    suggested_skills: [],
    suggested_tools: [],
    suggested_models: [],
    keywords,
    boundaries: {
      auto_install: false,
      auto_execute: false,
      auto_call_ai: false,
      display_only: true,
    },
  };

  if (!overlay) {
    base.next_step_hint = 'Mode A — core runtime. Set mode B via set_cognitive_mode for skill/model suggestions.';
    await persistInsights(workspaceRoot, base);
    return base;
  }

  const modelPreset = suggestModelPreset(ctx, intent);
  base.suggested_models = [modelPreset];
  base.next_step_hint = nextStepHint(intent, ctx);

  const candidates: Parameters<typeof rankCandidates>[0] = [];

  for (const local of searchLocalRegistry(keywords, 8)) {
    const km = keywordMatchScore(local.name, local.description, local.tags, keywords);
    candidates.push({
      name: local.name,
      description: local.description,
      source: 'local',
      link: local.link ?? `local://skill/${encodeURIComponent(local.name)}`,
      tags: local.tags,
      keyword_match: km,
      popularity: 0.5,
      recency: 0.8,
      reason: `Local registry match for ${intent.intent}`,
    });
  }

  const cache = await readSearchCache(workspaceRoot);
  const cacheHit = cache && cache.keywords.join(',') === keywords.join(',');

  if (!opts?.skipExternalSearch && !cacheHit) {
    const [gh, npm] = await Promise.all([searchGitHub(keywords), searchNpm(keywords)]);
    for (const hit of [...gh, ...npm]) {
      candidates.push({
        name: hit.name,
        description: hit.description,
        source: hit.source,
        link: hit.link,
        tags: hit.tags,
        keyword_match: keywordMatchScore(hit.name, hit.description, hit.tags, keywords),
        popularity: hit.popularity,
        recency: hit.recency,
        reason: `Detected ${intent.intent} — ${hit.source} search`,
      });
    }
    await writeSearchCache(workspaceRoot, keywords);
  }

  const ranked = rankCandidates(candidates, 12);
  base.suggested_skills = ranked
    .filter((r) => r.source === 'local' || r.source === 'github')
    .slice(0, 8)
    .map((r) =>
      toSkillSuggestion({
        name: r.name,
        reason: r.reason,
        source: r.source,
        link: r.link,
        score: r.score,
        tags: r.tags,
      }),
    );

  base.suggested_tools = ranked
    .filter((r) => r.source === 'npm')
    .slice(0, 6)
    .map((r) =>
      toSkillSuggestion({
        name: r.name,
        reason: r.reason,
        source: r.source,
        link: r.link,
        score: r.score,
        tags: r.tags,
      }),
    );

  await persistInsights(workspaceRoot, base);
  return base;
}

async function persistInsights(workspaceRoot: string, insights: CognitiveInsights): Promise<void> {
  const fp = insightsPath(workspaceRoot);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, `${JSON.stringify(insights, null, 2)}\n`, 'utf8');
}

export function observationOnlyPayload(mode: 'A' | 'B'): Pick<CognitiveInsights, 'mode' | 'cognitive_overlay_enabled' | 'boundaries'> {
  return {
    mode,
    cognitive_overlay_enabled: false,
    boundaries: {
      auto_install: false,
      auto_execute: false,
      auto_call_ai: false,
      display_only: true,
    },
  };
}
