import type { AIProvider, AiProviderId } from '../types.js';
export declare function createOpenAIProvider(opts: {
    apiKey: string;
    model: string;
    baseUrl?: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
}): AIProvider;
export declare function createAnthropicProvider(opts: {
    apiKey: string;
    model: string;
    baseUrl?: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
}): AIProvider;
export declare function createOllamaProvider(opts: {
    model: string;
    baseUrl?: string;
    defaultTemperature: number;
}): AIProvider;
/** OpenRouter uses OpenAI-compatible chat completions API. */
export declare function createOpenRouterProvider(opts: {
    apiKey: string;
    model: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
}): AIProvider;
export declare function createGeminiProvider(opts: {
    apiKey: string;
    model: string;
    baseUrl?: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
}): AIProvider;
export declare function providerLabel(id: AiProviderId): string;
//# sourceMappingURL=factory.d.ts.map