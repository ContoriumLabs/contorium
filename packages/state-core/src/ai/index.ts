export type {
  AiProviderId,
  AiModuleId,
  AiGenerateResult,
  AIProvider,
  AIResponse,
  GenerateOptions,
  IntentRouterConfig,
  IntentRouterMode,
  LlmConfig,
  LlmCacheConfig,
} from './types.js';

export {
  DEFAULT_LLM_CONFIG,
  LLM_CONFIG_REL,
  LLM_LOCAL_KEY_REL,
  LLM_KEYS_REL,
  CONTORIUM_LLM_API_KEY_ENV,
  isAiModuleEnabled,
  llmConfigPath,
  llmKeysPath,
  localLlmKeyPath,
  listConfiguredLlmProviders,
  readLlmConfig,
  readLocalLlmKey,
  readProviderLlmKey,
  resolveApiKey,
  resolveApiKeyForWorkspace,
  writeLlmConfig,
  writeLocalLlmKey,
  writeProviderLlmKey,
  hasLocalLlmKey,
  hasProviderLlmKey,
} from './config.js';

export { aiGenerate, getAiStatus, testAiConnection } from './runtime.js';
export { getAiProvider, getAiProviderFromConfig } from './registry.js';
export { routeIntent, routeQuery } from './routeIntent.js';
export { providerLabel } from './providers/factory.js';

export {
  enhanceAskAnswer,
  generateDnaWithAi,
  generateEssenceWithAi,
  generateStoryWithAi,
  generateWhyExplanation,
} from './generators/index.js';
