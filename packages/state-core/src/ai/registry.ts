import type { AIProvider, LlmConfig } from './types.js';
import {
  isAiModuleEnabled,
  readLlmConfig,
  resolveApiKey,
  resolveApiKeyForWorkspace,
} from './config.js';
import {
  createAnthropicProvider,
  createGeminiProvider,
  createOllamaProvider,
  createOpenAIProvider,
  createOpenRouterProvider,
} from './providers/factory.js';

export async function getAiProvider(workspaceRoot: string): Promise<AIProvider | null> {
  const config = await readLlmConfig(workspaceRoot);
  if (!config.enabled) {
    return null;
  }
  const apiKey = await resolveApiKeyForWorkspace(workspaceRoot, config);
  return getAiProviderFromConfig(config, apiKey);
}

export function getAiProviderFromConfig(config: LlmConfig, apiKeyOverride?: string): AIProvider | null {
  if (!config.enabled) {
    return null;
  }
  const common = {
    model: config.model,
    defaultTemperature: config.temperature,
    defaultMaxTokens: config.max_tokens,
    baseUrl: config.base_url,
  };
  const key = () => apiKeyOverride ?? resolveApiKey(config);
  switch (config.provider) {
    case 'openai': {
      const apiKey = key();
      if (!apiKey) {
        return null;
      }
      return createOpenAIProvider({ apiKey, ...common });
    }
    case 'anthropic': {
      const apiKey = key();
      if (!apiKey) {
        return null;
      }
      return createAnthropicProvider({ apiKey, ...common });
    }
    case 'open_router': {
      const apiKey = key();
      if (!apiKey) {
        return null;
      }
      return createOpenRouterProvider({
        apiKey,
        model: config.model,
        defaultTemperature: config.temperature,
        defaultMaxTokens: config.max_tokens,
      });
    }
    case 'ollama':
      return createOllamaProvider({
        model: config.model,
        baseUrl: config.base_url,
        defaultTemperature: config.temperature,
      });
    case 'gemini': {
      const apiKey = key();
      if (!apiKey) {
        return null;
      }
      return createGeminiProvider({ apiKey, ...common });
    }
    case 'deepseek': {
      const apiKey = key();
      if (!apiKey) {
        return null;
      }
      return createOpenAIProvider({
        apiKey,
        model: config.model,
        baseUrl: config.base_url ?? 'https://api.deepseek.com/v1',
        defaultTemperature: config.temperature,
        defaultMaxTokens: config.max_tokens,
      });
    }
    default:
      return null;
  }
}

export { isAiModuleEnabled, readLlmConfig, resolveApiKey, resolveApiKeyForWorkspace };
