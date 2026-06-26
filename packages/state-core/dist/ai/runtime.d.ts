import type { AiGenerateResult, AiModuleId, GenerateOptions } from './types.js';
/** Kernel-facing entry — returns null when LLM disabled or unavailable (caller keeps rule output). */
export declare function aiGenerate(workspaceRoot: string, module: AiModuleId, prompt: string, cacheKey?: string, options?: GenerateOptions): Promise<AiGenerateResult | null>;
export declare function testAiConnection(workspaceRoot: string): Promise<{
    ok: boolean;
    latency_ms: number;
    message: string;
    provider?: string;
    model?: string;
}>;
export declare function getAiStatus(workspaceRoot: string): Promise<{
    enabled: boolean;
    provider: string;
    model: string;
    modules: Record<string, boolean>;
    intent_router: string;
}>;
//# sourceMappingURL=runtime.d.ts.map