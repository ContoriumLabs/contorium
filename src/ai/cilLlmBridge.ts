import * as vscode from 'vscode';
import { CONTORA_CONFIG_SECTION } from '../constants';
import { ContoraKeyManager, type StoredProviderId } from './auth/keyManager';
import { readAiRuntimeSettings, type AiProviderSetting } from './auth/providerConfig';

type IntentRouterMode = 'rule' | 'hybrid' | 'llm';
type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'open_router' | 'ollama';

/** Injected at runtime from extension activate — never persisted to disk. */
export const IDE_LLM_ENV_KEY = 'CONTORIUM_IDE_LLM_API_KEY';

let keyManager: ContoraKeyManager | null = null;

export function bindCilLlmKeyManager(manager: ContoraKeyManager): void {
  keyManager = manager;
}

function storedProviderForIde(aiProvider: AiProviderSetting): StoredProviderId | null {
  if (aiProvider === 'off') {
    return null;
  }
  return aiProvider;
}

function mapIdeProviderToCil(aiProvider: AiProviderSetting): AiProviderId {
  switch (aiProvider) {
    case 'anthropic':
      return 'anthropic';
    case 'google':
      return 'gemini';
    case 'deepseek':
      return 'openai';
    case 'openai':
    default:
      return 'openai';
  }
}

function modelForIdeProvider(ai: ReturnType<typeof readAiRuntimeSettings>): string {
  switch (ai.aiProvider) {
    case 'anthropic':
      return ai.anthropicModel;
    case 'google':
      return ai.googleModel;
    case 'deepseek':
      return ai.deepseekModel;
    case 'openai':
      return ai.openaiModel;
    default:
      return ai.openaiModel;
  }
}

function baseUrlForIdeProvider(ai: ReturnType<typeof readAiRuntimeSettings>): string | undefined {
  if (ai.aiProvider === 'openai') {
    return ai.openaiBaseUrl;
  }
  if (ai.aiProvider === 'deepseek') {
    return ai.deepseekBaseUrl;
  }
  return undefined;
}

export function readCilAiSettings(): {
  cilAiEnabled: boolean;
  intentRouter: IntentRouterMode;
} {
  const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
  const rawRouter = (cfg.get<string>('cilIntentRouter') ?? 'hybrid').toLowerCase();
  const intentRouter: IntentRouterMode =
    rawRouter === 'rule' || rawRouter === 'hybrid' || rawRouter === 'llm' ? rawRouter : 'hybrid';
  return {
    cilAiEnabled: cfg.get<boolean>('cilAiEnabled') === true,
    intentRouter,
  };
}

/** Sync IDE BYOK settings → `.contora/config/llm.json` (no secrets in file). */
export async function syncCilLlmConfigFromIde(workspaceRoot: string): Promise<unknown> {
  const sc = await import('@contora/state-core');
  const { writeLlmConfig, DEFAULT_LLM_CONFIG } = sc;
  const { cilAiEnabled, intentRouter } = readCilAiSettings();
  const ai = readAiRuntimeSettings();
  const enabled = cilAiEnabled && ai.aiProvider !== 'off';
  const patch: Record<string, unknown> = {
    enabled,
    provider: mapIdeProviderToCil(ai.aiProvider),
    model: modelForIdeProvider(ai),
    api_key_env: IDE_LLM_ENV_KEY,
    base_url: baseUrlForIdeProvider(ai),
    intent_router: { enabled, mode: intentRouter },
    enabled_modules: DEFAULT_LLM_CONFIG.enabled_modules,
  };
  return writeLlmConfig(workspaceRoot, patch);
}

async function resolveIdeApiKey(): Promise<string | undefined> {
  if (!keyManager) {
    return undefined;
  }
  const ai = readAiRuntimeSettings();
  const stored = storedProviderForIde(ai.aiProvider);
  if (!stored) {
    return undefined;
  }
  const key = await keyManager.getKey(stored);
  return key?.trim() || undefined;
}

/** Run a CIL call with SecretStorage key injected into process.env for state-core. */
export async function withIdeCilAiContext<T>(
  workspaceRoot: string,
  fn: () => Promise<T>,
): Promise<T> {
  const { cilAiEnabled } = readCilAiSettings();
  const ai = readAiRuntimeSettings();
  if (!cilAiEnabled || ai.aiProvider === 'off') {
    return fn();
  }

  await syncCilLlmConfigFromIde(workspaceRoot);
  const apiKey = await resolveIdeApiKey();
  if (!apiKey) {
    return fn();
  }

  const prev = process.env[IDE_LLM_ENV_KEY];
  process.env[IDE_LLM_ENV_KEY] = apiKey;
  try {
    return await fn();
  } finally {
    if (prev === undefined) {
      delete process.env[IDE_LLM_ENV_KEY];
    } else {
      process.env[IDE_LLM_ENV_KEY] = prev;
    }
  }
}

export async function testIdeCilAiConnection(workspaceRoot: string): Promise<{
  ok: boolean;
  latency_ms: number;
  message: string;
  provider?: string;
  model?: string;
}> {
  const { cilAiEnabled } = readCilAiSettings();
  if (!cilAiEnabled) {
    return { ok: false, latency_ms: 0, message: 'CIL AI disabled — enable contora.cilAiEnabled in settings' };
  }
  const ai = readAiRuntimeSettings();
  if (ai.aiProvider === 'off') {
    return { ok: false, latency_ms: 0, message: 'Set contora.aiProvider and configure an API key' };
  }
  const apiKey = await resolveIdeApiKey();
  if (!apiKey) {
    return { ok: false, latency_ms: 0, message: 'API key missing — use Contorium: Configure API key…' };
  }
  return withIdeCilAiContext(workspaceRoot, async () => {
    const { testAiConnection } = await import('@contora/state-core');
    return testAiConnection(workspaceRoot);
  });
}

export async function loadIdeCilAiPanelState(workspaceRoot: string | undefined): Promise<{
  enabled: boolean;
  provider: string;
  model: string;
  intentRouter: string;
  keyReady: boolean;
  modulesOn: string[];
  configPath: string;
  needsKey: boolean;
}> {
  const { cilAiEnabled, intentRouter } = readCilAiSettings();
  const ai = readAiRuntimeSettings();
  const keyReady = Boolean(await resolveIdeApiKey());
  const needsKey = cilAiEnabled && ai.aiProvider !== 'off' && !keyReady;

  let modulesOn: string[] = [];
  let provider: string = mapIdeProviderToCil(ai.aiProvider);
  let model = modelForIdeProvider(ai);
  let enabled = cilAiEnabled && ai.aiProvider !== 'off';

  if (workspaceRoot) {
    try {
      const { getAiStatus } = await import('@contora/state-core');
      const status = await getAiStatus(workspaceRoot);
      enabled = status.enabled;
      provider = status.provider;
      model = status.model;
      modulesOn = Object.entries(status.modules)
        .filter(([, on]) => on)
        .map(([m]) => m);
    } catch {
      /* workspace may not have llm.json yet */
    }
  }

  return {
    enabled,
    provider,
    model,
    intentRouter,
    keyReady,
    modulesOn,
    configPath: '.contora/config/llm.json',
    needsKey,
  };
}
