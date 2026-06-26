"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readLlmCache = readLlmCache;
exports.writeLlmCache = writeLlmCache;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
function cacheDir(workspaceRoot) {
    return node_path_1.default.join(workspaceRoot, '.contora', 'cache', 'llm');
}
function cacheFile(workspaceRoot, module, key) {
    const hash = node_crypto_1.default.createHash('sha256').update(key).digest('hex').slice(0, 24);
    return node_path_1.default.join(cacheDir(workspaceRoot), module, `${hash}.json`);
}
async function readLlmCache(workspaceRoot, config, module, key) {
    if (!config.cache?.enabled) {
        return null;
    }
    const ttlDays = config.cache.ttl_days ?? 30;
    const file = cacheFile(workspaceRoot, module, key);
    try {
        const raw = await promises_1.default.readFile(file, 'utf8');
        const entry = JSON.parse(raw);
        const ageMs = Date.now() - new Date(entry.created_at).getTime();
        if (ageMs > ttlDays * 86400_000) {
            return null;
        }
        return entry.text;
    }
    catch {
        return null;
    }
}
async function writeLlmCache(workspaceRoot, module, key, text) {
    const file = cacheFile(workspaceRoot, module, key);
    await promises_1.default.mkdir(node_path_1.default.dirname(file), { recursive: true });
    const entry = { text, created_at: new Date().toISOString(), module };
    await promises_1.default.writeFile(file, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
}
