import type { AiProviderId } from '@contora/state-core';
import {
  CONTORIUM_LLM_API_KEY_ENV,
  DEFAULT_LLM_CONFIG,
  hasProviderLlmKey,
  listConfiguredLlmProviders,
  readLlmConfig,
  testAiConnection,
  writeLlmConfig,
  writeProviderLlmKey,
} from '@contora/state-core';

export const LLM_PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  open_router: 'OpenRouter',
  gemini: 'Gemini',
  ollama: 'Ollama (local)',
  deepseek: 'DeepSeek',
};

export const LLM_DEFAULT_MODELS: Record<AiProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  open_router: 'openai/gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
  ollama: 'llama3.2',
  deepseek: 'deepseek-chat',
};

export const LLM_DEFAULT_BASE_URLS: Partial<Record<AiProviderId, string>> = {
  deepseek: 'https://api.deepseek.com/v1',
};

/** Provider pick list — step 1 only (no parallel test/key items). */
export const LLM_PROVIDER_ORDER: AiProviderId[] = [
  'openai',
  'anthropic',
  'open_router',
  'gemini',
  'deepseek',
  'ollama',
];

export type LlmConfigStep = 'provider' | 'key';

export interface DashboardLlmSnapshot {
  enabled: boolean;
  provider: AiProviderId;
  model: string;
  /** Providers that already have a saved API key. */
  configuredProviders: AiProviderId[];
  /** Whether the currently active provider has its own key. */
  activeProviderHasKey: boolean;
  keyHint: string;
}

export interface DashboardLlmTestResult {
  ok: boolean;
  message: string;
  latency_ms?: number;
  at: number;
}

export async function loadDashboardLlmSnapshot(workspaceRoot: string): Promise<DashboardLlmSnapshot> {
  const config = await readLlmConfig(workspaceRoot);
  const configuredProviders = await listConfiguredLlmProviders(workspaceRoot);
  const provider = (config.provider ?? DEFAULT_LLM_CONFIG.provider) as AiProviderId;
  const activeProviderHasKey = await hasProviderLlmKey(workspaceRoot, provider);
  return {
    enabled: config.enabled,
    provider,
    model: config.model,
    configuredProviders,
    activeProviderHasKey,
    keyHint: activeProviderHasKey ? 'configured' : '(not set)',
  };
}

export function providerHasSavedKey(
  snapshot: DashboardLlmSnapshot | undefined,
  provider: AiProviderId,
): boolean {
  if (provider === 'ollama') {
    return true;
  }
  return snapshot?.configuredProviders.includes(provider) === true;
}

export async function applyDashboardLlmProvider(
  workspaceRoot: string,
  provider: AiProviderId,
): Promise<void> {
  const baseUrl = LLM_DEFAULT_BASE_URLS[provider];
  await writeLlmConfig(workspaceRoot, {
    enabled: true,
    provider,
    model: LLM_DEFAULT_MODELS[provider] ?? DEFAULT_LLM_CONFIG.model,
    base_url: baseUrl,
    api_key_env: provider === 'ollama' ? undefined : CONTORIUM_LLM_API_KEY_ENV,
    intent_router: { enabled: true, mode: 'hybrid' },
    enabled_modules: DEFAULT_LLM_CONFIG.enabled_modules,
  });
}

export async function saveDashboardLlmKeyAndTest(
  workspaceRoot: string,
  provider: AiProviderId,
  apiKey: string,
): Promise<DashboardLlmTestResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, message: 'API key empty', at: Date.now() };
  }
  await writeProviderLlmKey(workspaceRoot, provider, trimmed);
  await writeLlmConfig(workspaceRoot, {
    api_key_env: CONTORIUM_LLM_API_KEY_ENV,
    enabled: true,
    provider,
  });
  return runDashboardLlmTest(workspaceRoot);
}

export async function runDashboardLlmTest(workspaceRoot: string): Promise<DashboardLlmTestResult> {
  const config = await readLlmConfig(workspaceRoot);
  if (!config.enabled) {
    return { ok: false, message: 'LLM disabled — select a provider first', at: Date.now() };
  }
  if (config.provider !== 'ollama') {
    const hasKey = await hasProviderLlmKey(workspaceRoot, config.provider);
    const envKey = process.env[CONTORIUM_LLM_API_KEY_ENV]?.trim();
    if (!hasKey && !envKey) {
      return {
        ok: false,
        message: `No API key for ${LLM_PROVIDER_LABELS[config.provider] ?? config.provider} — enter key`,
        at: Date.now(),
      };
    }
  }
  const result = await testAiConnection(workspaceRoot);
  return {
    ok: result.ok,
    message: result.ok
      ? `OK — ${result.provider ?? config.provider} / ${result.model ?? config.model} (${result.latency_ms}ms)`
      : result.message,
    latency_ms: result.latency_ms,
    at: Date.now(),
  };
}

export function providerNeedsApiKey(provider: AiProviderId): boolean {
  return provider !== 'ollama';
}
