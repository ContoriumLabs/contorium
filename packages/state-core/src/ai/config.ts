import fs from 'node:fs/promises';
import path from 'node:path';
import type { AiProviderId, LlmConfig } from './types.js';

export const LLM_CONFIG_REL = '.contora/config/llm.json';

/** Legacy single-key file — migrated into LLM_KEYS_REL on read. */
export const LLM_LOCAL_KEY_REL = '.contora/config/.llm-key';

/** Per-provider API keys (gitignored via .contora/). */
export const LLM_KEYS_REL = '.contora/config/.llm-keys.json';

/** Env var used when key is stored locally. */
export const CONTORIUM_LLM_API_KEY_ENV = 'CONTORIUM_LLM_API_KEY';

type LlmKeysStore = Partial<Record<AiProviderId, string>>;

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: false,
  provider: 'openai',
  model: 'gpt-4o-mini',
  api_key_env: 'OPENAI_API_KEY',
  temperature: 0.2,
  max_tokens: 4000,
  intent_router: { enabled: false, mode: 'hybrid' },
  enabled_modules: ['why', 'story', 'essence', 'dna', 'ask_enhance'],
  cache: { enabled: true, ttl_days: 30 },
};

export function llmConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, LLM_CONFIG_REL);
}

export async function readLlmConfig(workspaceRoot: string): Promise<LlmConfig> {
  try {
    const raw = await fs.readFile(llmConfigPath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as Partial<LlmConfig>;
    return {
      ...DEFAULT_LLM_CONFIG,
      ...parsed,
      intent_router: {
        enabled: parsed.intent_router?.enabled ?? DEFAULT_LLM_CONFIG.intent_router!.enabled,
        mode: parsed.intent_router?.mode ?? DEFAULT_LLM_CONFIG.intent_router!.mode,
      },
      cache: {
        enabled: parsed.cache?.enabled ?? DEFAULT_LLM_CONFIG.cache!.enabled,
        ttl_days: parsed.cache?.ttl_days ?? DEFAULT_LLM_CONFIG.cache!.ttl_days,
      },
      enabled_modules: parsed.enabled_modules ?? DEFAULT_LLM_CONFIG.enabled_modules,
    };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

export async function writeLlmConfig(workspaceRoot: string, patch: Partial<LlmConfig>): Promise<LlmConfig> {
  const current = await readLlmConfig(workspaceRoot);
  const next: LlmConfig = {
    ...current,
    ...patch,
    intent_router: {
      enabled: patch.intent_router?.enabled ?? current.intent_router!.enabled,
      mode: patch.intent_router?.mode ?? current.intent_router!.mode,
    },
    cache: {
      enabled: patch.cache?.enabled ?? current.cache!.enabled,
      ttl_days: patch.cache?.ttl_days ?? current.cache!.ttl_days,
    },
    enabled_modules: patch.enabled_modules ?? current.enabled_modules,
  };
  const file = llmConfigPath(workspaceRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function resolveApiKey(config: LlmConfig): string | undefined {
  const envName = config.api_key_env?.trim();
  if (!envName) {
    return undefined;
  }
  const v = process.env[envName]?.trim();
  return v || undefined;
}

export function localLlmKeyPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, LLM_LOCAL_KEY_REL);
}

export function llmKeysPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, LLM_KEYS_REL);
}

async function readLegacySingleKey(workspaceRoot: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(localLlmKeyPath(workspaceRoot), 'utf8');
    const key = raw.trim();
    return key || undefined;
  } catch {
    return undefined;
  }
}

async function writeLlmKeysStore(workspaceRoot: string, store: LlmKeysStore): Promise<void> {
  const file = llmKeysPath(workspaceRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

async function readLlmKeysStore(workspaceRoot: string): Promise<LlmKeysStore> {
  const file = llmKeysPath(workspaceRoot);
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as LlmKeysStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    const legacy = await readLegacySingleKey(workspaceRoot);
    if (!legacy) {
      return {};
    }
    const config = await readLlmConfig(workspaceRoot);
    const store: LlmKeysStore = { [config.provider]: legacy };
    await writeLlmKeysStore(workspaceRoot, store);
    return store;
  }
}

export async function readProviderLlmKey(
  workspaceRoot: string,
  provider: AiProviderId,
): Promise<string | undefined> {
  const store = await readLlmKeysStore(workspaceRoot);
  const key = store[provider]?.trim();
  return key || undefined;
}

export async function writeProviderLlmKey(
  workspaceRoot: string,
  provider: AiProviderId,
  apiKey: string,
): Promise<void> {
  const store = await readLlmKeysStore(workspaceRoot);
  store[provider] = apiKey.trim();
  await writeLlmKeysStore(workspaceRoot, store);
}

export async function hasProviderLlmKey(workspaceRoot: string, provider: AiProviderId): Promise<boolean> {
  if (provider === 'ollama') {
    return true;
  }
  const key = await readProviderLlmKey(workspaceRoot, provider);
  return Boolean(key);
}

export async function listConfiguredLlmProviders(workspaceRoot: string): Promise<AiProviderId[]> {
  const store = await readLlmKeysStore(workspaceRoot);
  return (Object.keys(store) as AiProviderId[]).filter((id) => Boolean(store[id]?.trim()));
}

export async function readLocalLlmKey(workspaceRoot: string): Promise<string | undefined> {
  const config = await readLlmConfig(workspaceRoot);
  return readProviderLlmKey(workspaceRoot, config.provider);
}

export async function writeLocalLlmKey(
  workspaceRoot: string,
  apiKey: string,
  provider?: AiProviderId,
): Promise<void> {
  const prov = provider ?? (await readLlmConfig(workspaceRoot)).provider;
  await writeProviderLlmKey(workspaceRoot, prov, apiKey);
}

export async function hasLocalLlmKey(workspaceRoot: string, provider?: AiProviderId): Promise<boolean> {
  const prov = provider ?? (await readLlmConfig(workspaceRoot)).provider;
  return hasProviderLlmKey(workspaceRoot, prov);
}

/** Environment variable first, then workspace `.llm-key` file. */
export async function resolveApiKeyForWorkspace(
  workspaceRoot: string,
  config: LlmConfig,
): Promise<string | undefined> {
  const fromEnv = resolveApiKey(config);
  if (fromEnv) {
    return fromEnv;
  }
  return readProviderLlmKey(workspaceRoot, config.provider);
}

export function isAiModuleEnabled(config: LlmConfig, module: LlmConfig['enabled_modules'][number]): boolean {
  return config.enabled === true && config.enabled_modules.includes(module);
}
