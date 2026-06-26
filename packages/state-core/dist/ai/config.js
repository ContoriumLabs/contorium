"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LLM_CONFIG = exports.CONTORIUM_LLM_API_KEY_ENV = exports.LLM_KEYS_REL = exports.LLM_LOCAL_KEY_REL = exports.LLM_CONFIG_REL = void 0;
exports.llmConfigPath = llmConfigPath;
exports.readLlmConfig = readLlmConfig;
exports.writeLlmConfig = writeLlmConfig;
exports.resolveApiKey = resolveApiKey;
exports.localLlmKeyPath = localLlmKeyPath;
exports.llmKeysPath = llmKeysPath;
exports.readProviderLlmKey = readProviderLlmKey;
exports.writeProviderLlmKey = writeProviderLlmKey;
exports.hasProviderLlmKey = hasProviderLlmKey;
exports.listConfiguredLlmProviders = listConfiguredLlmProviders;
exports.readLocalLlmKey = readLocalLlmKey;
exports.writeLocalLlmKey = writeLocalLlmKey;
exports.hasLocalLlmKey = hasLocalLlmKey;
exports.resolveApiKeyForWorkspace = resolveApiKeyForWorkspace;
exports.isAiModuleEnabled = isAiModuleEnabled;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
exports.LLM_CONFIG_REL = '.contora/config/llm.json';
/** Legacy single-key file — migrated into LLM_KEYS_REL on read. */
exports.LLM_LOCAL_KEY_REL = '.contora/config/.llm-key';
/** Per-provider API keys (gitignored via .contora/). */
exports.LLM_KEYS_REL = '.contora/config/.llm-keys.json';
/** Env var used when key is stored locally. */
exports.CONTORIUM_LLM_API_KEY_ENV = 'CONTORIUM_LLM_API_KEY';
exports.DEFAULT_LLM_CONFIG = {
    enabled: false,
    provider: 'openai',
    model: 'gpt-4o-mini',
    api_key_env: 'OPENAI_API_KEY',
    temperature: 0.2,
    max_tokens: 4000,
    intent_router: { enabled: false, mode: 'hybrid' },
    enabled_modules: ['why', 'story', 'essence', 'dna', 'ask_enhance'],
    cache: { enabled: true, ttl_days: 30 },
};
function llmConfigPath(workspaceRoot) {
    return node_path_1.default.join(workspaceRoot, exports.LLM_CONFIG_REL);
}
async function readLlmConfig(workspaceRoot) {
    try {
        const raw = await promises_1.default.readFile(llmConfigPath(workspaceRoot), 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ...exports.DEFAULT_LLM_CONFIG,
            ...parsed,
            intent_router: {
                enabled: parsed.intent_router?.enabled ?? exports.DEFAULT_LLM_CONFIG.intent_router.enabled,
                mode: parsed.intent_router?.mode ?? exports.DEFAULT_LLM_CONFIG.intent_router.mode,
            },
            cache: {
                enabled: parsed.cache?.enabled ?? exports.DEFAULT_LLM_CONFIG.cache.enabled,
                ttl_days: parsed.cache?.ttl_days ?? exports.DEFAULT_LLM_CONFIG.cache.ttl_days,
            },
            enabled_modules: parsed.enabled_modules ?? exports.DEFAULT_LLM_CONFIG.enabled_modules,
        };
    }
    catch {
        return { ...exports.DEFAULT_LLM_CONFIG };
    }
}
async function writeLlmConfig(workspaceRoot, patch) {
    const current = await readLlmConfig(workspaceRoot);
    const next = {
        ...current,
        ...patch,
        intent_router: {
            enabled: patch.intent_router?.enabled ?? current.intent_router.enabled,
            mode: patch.intent_router?.mode ?? current.intent_router.mode,
        },
        cache: {
            enabled: patch.cache?.enabled ?? current.cache.enabled,
            ttl_days: patch.cache?.ttl_days ?? current.cache.ttl_days,
        },
        enabled_modules: patch.enabled_modules ?? current.enabled_modules,
    };
    const file = llmConfigPath(workspaceRoot);
    await promises_1.default.mkdir(node_path_1.default.dirname(file), { recursive: true });
    await promises_1.default.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
}
function resolveApiKey(config) {
    const envName = config.api_key_env?.trim();
    if (!envName) {
        return undefined;
    }
    const v = process.env[envName]?.trim();
    return v || undefined;
}
function localLlmKeyPath(workspaceRoot) {
    return node_path_1.default.join(workspaceRoot, exports.LLM_LOCAL_KEY_REL);
}
function llmKeysPath(workspaceRoot) {
    return node_path_1.default.join(workspaceRoot, exports.LLM_KEYS_REL);
}
async function readLegacySingleKey(workspaceRoot) {
    try {
        const raw = await promises_1.default.readFile(localLlmKeyPath(workspaceRoot), 'utf8');
        const key = raw.trim();
        return key || undefined;
    }
    catch {
        return undefined;
    }
}
async function writeLlmKeysStore(workspaceRoot, store) {
    const file = llmKeysPath(workspaceRoot);
    await promises_1.default.mkdir(node_path_1.default.dirname(file), { recursive: true });
    await promises_1.default.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}
async function readLlmKeysStore(workspaceRoot) {
    const file = llmKeysPath(workspaceRoot);
    try {
        const raw = await promises_1.default.readFile(file, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        const legacy = await readLegacySingleKey(workspaceRoot);
        if (!legacy) {
            return {};
        }
        const config = await readLlmConfig(workspaceRoot);
        const store = { [config.provider]: legacy };
        await writeLlmKeysStore(workspaceRoot, store);
        return store;
    }
}
async function readProviderLlmKey(workspaceRoot, provider) {
    const store = await readLlmKeysStore(workspaceRoot);
    const key = store[provider]?.trim();
    return key || undefined;
}
async function writeProviderLlmKey(workspaceRoot, provider, apiKey) {
    const store = await readLlmKeysStore(workspaceRoot);
    store[provider] = apiKey.trim();
    await writeLlmKeysStore(workspaceRoot, store);
}
async function hasProviderLlmKey(workspaceRoot, provider) {
    if (provider === 'ollama') {
        return true;
    }
    const key = await readProviderLlmKey(workspaceRoot, provider);
    return Boolean(key);
}
async function listConfiguredLlmProviders(workspaceRoot) {
    const store = await readLlmKeysStore(workspaceRoot);
    return Object.keys(store).filter((id) => Boolean(store[id]?.trim()));
}
async function readLocalLlmKey(workspaceRoot) {
    const config = await readLlmConfig(workspaceRoot);
    return readProviderLlmKey(workspaceRoot, config.provider);
}
async function writeLocalLlmKey(workspaceRoot, apiKey, provider) {
    const prov = provider ?? (await readLlmConfig(workspaceRoot)).provider;
    await writeProviderLlmKey(workspaceRoot, prov, apiKey);
}
async function hasLocalLlmKey(workspaceRoot, provider) {
    const prov = provider ?? (await readLlmConfig(workspaceRoot)).provider;
    return hasProviderLlmKey(workspaceRoot, prov);
}
/** Environment variable first, then workspace `.llm-key` file. */
async function resolveApiKeyForWorkspace(workspaceRoot, config) {
    const fromEnv = resolveApiKey(config);
    if (fromEnv) {
        return fromEnv;
    }
    return readProviderLlmKey(workspaceRoot, config.provider);
}
function isAiModuleEnabled(config, module) {
    return config.enabled === true && config.enabled_modules.includes(module);
}
