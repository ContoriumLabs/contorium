import type { AiGenerateResult, AiModuleId, GenerateOptions } from './types.js';
import { isAiModuleEnabled, readLlmConfig } from './config.js';
import { readLlmCache, writeLlmCache } from './cache.js';
import { getAiProvider } from './registry.js';

const SYSTEM_PROMPT =
  'You are Contorium AI — explain project intelligence from structured facts only. ' +
  'Never invent decisions, files, or events. If facts are insufficient, say so briefly.';

/** Kernel-facing entry — returns null when LLM disabled or unavailable (caller keeps rule output). */
export async function aiGenerate(
  workspaceRoot: string,
  module: AiModuleId,
  prompt: string,
  cacheKey?: string,
  options?: GenerateOptions,
): Promise<AiGenerateResult | null> {
  const config = await readLlmConfig(workspaceRoot);
  if (module === 'intent_router') {
    if (!config.enabled || !config.intent_router?.enabled) {
      return null;
    }
  } else if (!isAiModuleEnabled(config, module)) {
    return null;
  }

  const key = cacheKey ?? prompt.slice(0, 512);
  const cached = await readLlmCache(workspaceRoot, config, module, key);
  if (cached) {
    return { text: cached, source: 'cache', cached: true };
  }

  const provider = await getAiProvider(workspaceRoot);
  if (!provider) {
    return null;
  }

  try {
    const res = await provider.generate(prompt, {
      system: SYSTEM_PROMPT,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      ...options,
    });
    if (!res.text.trim()) {
      return null;
    }
    if (config.cache?.enabled) {
      await writeLlmCache(workspaceRoot, module, key, res.text);
    }
    return { text: res.text, source: 'llm', provider: res.provider, cached: false };
  } catch {
    return null;
  }
}

export async function testAiConnection(workspaceRoot: string): Promise<{
  ok: boolean;
  latency_ms: number;
  message: string;
  provider?: string;
  model?: string;
}> {
  const config = await readLlmConfig(workspaceRoot);
  const provider = await getAiProvider(workspaceRoot);
  if (!provider) {
    const { resolveApiKeyForWorkspace, hasProviderLlmKey } = await import('./config.js');
    const hasKey =
      config.provider === 'ollama' ||
      Boolean(await resolveApiKeyForWorkspace(workspaceRoot, config)) ||
      (await hasProviderLlmKey(workspaceRoot, config.provider));
    return {
      ok: false,
      latency_ms: 0,
      message: config.enabled
        ? hasKey
          ? `Provider ${config.provider} unavailable — check model/base URL`
          : `No API key — use CLI dashboard LLM Config or set ${config.api_key_env ?? 'CONTORIUM_LLM_API_KEY'}`
        : 'LLM disabled — select provider in dashboard or run contorium ai setup',
    };
  }
  const test = await provider.testConnection();
  return { ...test, provider: config.provider, model: config.model };
}

export async function getAiStatus(workspaceRoot: string): Promise<{
  enabled: boolean;
  provider: string;
  model: string;
  modules: Record<string, boolean>;
  intent_router: string;
}> {
  const config = await readLlmConfig(workspaceRoot);
  const modules: Record<string, boolean> = {};
  for (const m of ['why', 'story', 'essence', 'dna', 'action', 'questions', 'ask_enhance'] as const) {
    modules[m] = isAiModuleEnabled(config, m);
  }
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    modules,
    intent_router: config.intent_router?.mode ?? 'rule',
  };
}
