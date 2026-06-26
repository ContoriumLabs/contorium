"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiGenerate = aiGenerate;
exports.testAiConnection = testAiConnection;
exports.getAiStatus = getAiStatus;
const config_js_1 = require("./config.js");
const cache_js_1 = require("./cache.js");
const registry_js_1 = require("./registry.js");
const SYSTEM_PROMPT = 'You are Contorium AI — explain project intelligence from structured facts only. ' +
    'Never invent decisions, files, or events. If facts are insufficient, say so briefly.';
/** Kernel-facing entry — returns null when LLM disabled or unavailable (caller keeps rule output). */
async function aiGenerate(workspaceRoot, module, prompt, cacheKey, options) {
    const config = await (0, config_js_1.readLlmConfig)(workspaceRoot);
    if (module === 'intent_router') {
        if (!config.enabled || !config.intent_router?.enabled) {
            return null;
        }
    }
    else if (!(0, config_js_1.isAiModuleEnabled)(config, module)) {
        return null;
    }
    const key = cacheKey ?? prompt.slice(0, 512);
    const cached = await (0, cache_js_1.readLlmCache)(workspaceRoot, config, module, key);
    if (cached) {
        return { text: cached, source: 'cache', cached: true };
    }
    const provider = await (0, registry_js_1.getAiProvider)(workspaceRoot);
    if (!provider) {
        return null;
    }
    try {
        const res = await provider.generate(prompt, {
            system: SYSTEM_PROMPT,
            temperature: config.temperature,
            max_tokens: config.max_tokens,
            ...options,
        });
        if (!res.text.trim()) {
            return null;
        }
        if (config.cache?.enabled) {
            await (0, cache_js_1.writeLlmCache)(workspaceRoot, module, key, res.text);
        }
        return { text: res.text, source: 'llm', provider: res.provider, cached: false };
    }
    catch {
        return null;
    }
}
async function testAiConnection(workspaceRoot) {
    const config = await (0, config_js_1.readLlmConfig)(workspaceRoot);
    const provider = await (0, registry_js_1.getAiProvider)(workspaceRoot);
    if (!provider) {
        const { resolveApiKeyForWorkspace, hasProviderLlmKey } = await Promise.resolve().then(() => __importStar(require('./config.js')));
        const hasKey = config.provider === 'ollama' ||
            Boolean(await resolveApiKeyForWorkspace(workspaceRoot, config)) ||
            (await hasProviderLlmKey(workspaceRoot, config.provider));
        return {
            ok: false,
            latency_ms: 0,
            message: config.enabled
                ? hasKey
                    ? `Provider ${config.provider} unavailable — check model/base URL`
                    : `No API key — use CLI dashboard LLM Config or set ${config.api_key_env ?? 'CONTORIUM_LLM_API_KEY'}`
                : 'LLM disabled — select provider in dashboard or run contorium ai setup',
        };
    }
    const test = await provider.testConnection();
    return { ...test, provider: config.provider, model: config.model };
}
async function getAiStatus(workspaceRoot) {
    const config = await (0, config_js_1.readLlmConfig)(workspaceRoot);
    const modules = {};
    for (const m of ['why', 'story', 'essence', 'dna', 'action', 'questions', 'ask_enhance']) {
        modules[m] = (0, config_js_1.isAiModuleEnabled)(config, m);
    }
    return {
        enabled: config.enabled,
        provider: config.provider,
        model: config.model,
        modules,
        intent_router: config.intent_router?.mode ?? 'rule',
    };
}
