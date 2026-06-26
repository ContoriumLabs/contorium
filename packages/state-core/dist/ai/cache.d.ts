import type { AiModuleId, LlmConfig } from './types.js';
export declare function readLlmCache(workspaceRoot: string, config: LlmConfig, module: AiModuleId, key: string): Promise<string | null>;
export declare function writeLlmCache(workspaceRoot: string, module: AiModuleId, key: string, text: string): Promise<void>;
//# sourceMappingURL=cache.d.ts.map