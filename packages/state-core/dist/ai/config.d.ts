import type { AiProviderId, LlmConfig } from './types.js';
export declare const LLM_CONFIG_REL = ".contora/config/llm.json";
/** Legacy single-key file — migrated into LLM_KEYS_REL on read. */
export declare const LLM_LOCAL_KEY_REL = ".contora/config/.llm-key";
/** Per-provider API keys (gitignored via .contora/). */
export declare const LLM_KEYS_REL = ".contora/config/.llm-keys.json";
/** Env var used when key is stored locally. */
export declare const CONTORIUM_LLM_API_KEY_ENV = "CONTORIUM_LLM_API_KEY";
export declare const DEFAULT_LLM_CONFIG: LlmConfig;
export declare function llmConfigPath(workspaceRoot: string): string;
export declare function readLlmConfig(workspaceRoot: string): Promise<LlmConfig>;
export declare function writeLlmConfig(workspaceRoot: string, patch: Partial<LlmConfig>): Promise<LlmConfig>;
export declare function resolveApiKey(config: LlmConfig): string | undefined;
export declare function localLlmKeyPath(workspaceRoot: string): string;
export declare function llmKeysPath(workspaceRoot: string): string;
export declare function readProviderLlmKey(workspaceRoot: string, provider: AiProviderId): Promise<string | undefined>;
export declare function writeProviderLlmKey(workspaceRoot: string, provider: AiProviderId, apiKey: string): Promise<void>;
export declare function hasProviderLlmKey(workspaceRoot: string, provider: AiProviderId): Promise<boolean>;
export declare function listConfiguredLlmProviders(workspaceRoot: string): Promise<AiProviderId[]>;
export declare function readLocalLlmKey(workspaceRoot: string): Promise<string | undefined>;
export declare function writeLocalLlmKey(workspaceRoot: string, apiKey: string, provider?: AiProviderId): Promise<void>;
export declare function hasLocalLlmKey(workspaceRoot: string, provider?: AiProviderId): Promise<boolean>;
/** Environment variable first, then workspace `.llm-key` file. */
export declare function resolveApiKeyForWorkspace(workspaceRoot: string, config: LlmConfig): Promise<string | undefined>;
export declare function isAiModuleEnabled(config: LlmConfig, module: LlmConfig['enabled_modules'][number]): boolean;
//# sourceMappingURL=config.d.ts.map