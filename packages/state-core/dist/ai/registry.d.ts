import type { AIProvider, LlmConfig } from './types.js';
import { isAiModuleEnabled, readLlmConfig, resolveApiKey, resolveApiKeyForWorkspace } from './config.js';
export declare function getAiProvider(workspaceRoot: string): Promise<AIProvider | null>;
export declare function getAiProviderFromConfig(config: LlmConfig, apiKeyOverride?: string): AIProvider | null;
export { isAiModuleEnabled, readLlmConfig, resolveApiKey, resolveApiKeyForWorkspace };
//# sourceMappingURL=registry.d.ts.map