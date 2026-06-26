/** Contorium AI Provider Layer — model-agnostic LLM abstraction (explanation layer only). */
export type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'open_router' | 'ollama' | 'deepseek';
export type IntentRouterMode = 'rule' | 'hybrid' | 'llm';
export type AiModuleId = 'why' | 'story' | 'essence' | 'dna' | 'action' | 'questions' | 'intent_router' | 'ask_enhance';
export interface LlmBudgetConfig {
    monthly_tokens: number;
    warning_threshold: number;
}
export interface LlmCacheConfig {
    enabled: boolean;
    ttl_days: number;
}
export interface IntentRouterConfig {
    enabled: boolean;
    mode: IntentRouterMode;
}
export interface LlmConfig {
    enabled: boolean;
    provider: AiProviderId;
    model: string;
    /** Read API key from environment — never store secrets in llm.json */
    api_key_env?: string;
    base_url?: string;
    temperature: number;
    max_tokens: number;
    intent_router?: IntentRouterConfig;
    enabled_modules: AiModuleId[];
    budget?: LlmBudgetConfig;
    cache?: LlmCacheConfig;
}
export interface GenerateOptions {
    temperature?: number;
    max_tokens?: number;
    model?: string;
    system?: string;
}
export interface AIResponse {
    text: string;
    model: string;
    provider: AiProviderId;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
    latency_ms: number;
    cached?: boolean;
}
export interface AIProvider {
    readonly id: AiProviderId;
    generate(prompt: string, options?: GenerateOptions): Promise<AIResponse>;
    testConnection(): Promise<{
        ok: boolean;
        latency_ms: number;
        message: string;
    }>;
}
export interface AiGenerateResult {
    text: string;
    source: 'llm' | 'cache' | 'rule';
    provider?: AiProviderId;
    cached?: boolean;
}
//# sourceMappingURL=types.d.ts.map