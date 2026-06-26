"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveApiKeyForWorkspace = exports.resolveApiKey = exports.readLlmConfig = exports.isAiModuleEnabled = void 0;
exports.getAiProvider = getAiProvider;
exports.getAiProviderFromConfig = getAiProviderFromConfig;
const config_js_1 = require("./config.js");
Object.defineProperty(exports, "isAiModuleEnabled", { enumerable: true, get: function () { return config_js_1.isAiModuleEnabled; } });
Object.defineProperty(exports, "readLlmConfig", { enumerable: true, get: function () { return config_js_1.readLlmConfig; } });
Object.defineProperty(exports, "resolveApiKey", { enumerable: true, get: function () { return config_js_1.resolveApiKey; } });
Object.defineProperty(exports, "resolveApiKeyForWorkspace", { enumerable: true, get: function () { return config_js_1.resolveApiKeyForWorkspace; } });
const factory_js_1 = require("./providers/factory.js");
async function getAiProvider(workspaceRoot) {
    const config = await (0, config_js_1.readLlmConfig)(workspaceRoot);
    if (!config.enabled) {
        return null;
    }
    const apiKey = await (0, config_js_1.resolveApiKeyForWorkspace)(workspaceRoot, config);
    return getAiProviderFromConfig(config, apiKey);
}
function getAiProviderFromConfig(config, apiKeyOverride) {
    if (!config.enabled) {
        return null;
    }
    const common = {
        model: config.model,
        defaultTemperature: config.temperature,
        defaultMaxTokens: config.max_tokens,
        baseUrl: config.base_url,
    };
    const key = () => apiKeyOverride ?? (0, config_js_1.resolveApiKey)(config);
    switch (config.provider) {
        case 'openai': {
            const apiKey = key();
            if (!apiKey) {
                return null;
            }
            return (0, factory_js_1.createOpenAIProvider)({ apiKey, ...common });
        }
        case 'anthropic': {
            const apiKey = key();
            if (!apiKey) {
                return null;
            }
            return (0, factory_js_1.createAnthropicProvider)({ apiKey, ...common });
        }
        case 'open_router': {
            const apiKey = key();
            if (!apiKey) {
                return null;
            }
            return (0, factory_js_1.createOpenRouterProvider)({
                apiKey,
                model: config.model,
                defaultTemperature: config.temperature,
                defaultMaxTokens: config.max_tokens,
            });
        }
        case 'ollama':
            return (0, factory_js_1.createOllamaProvider)({
                model: config.model,
                baseUrl: config.base_url,
                defaultTemperature: config.temperature,
            });
        case 'gemini': {
            const apiKey = key();
            if (!apiKey) {
                return null;
            }
            return (0, factory_js_1.createGeminiProvider)({ apiKey, ...common });
        }
        case 'deepseek': {
            const apiKey = key();
            if (!apiKey) {
                return null;
            }
            return (0, factory_js_1.createOpenAIProvider)({
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
