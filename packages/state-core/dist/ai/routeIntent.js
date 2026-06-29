"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeQuery = void 0;
exports.routeIntent = routeIntent;
const queryRouter_js_1 = require("../cil/queryRouter.js");
Object.defineProperty(exports, "routeQuery", { enumerable: true, get: function () { return queryRouter_js_1.routeQuery; } });
const config_js_1 = require("./config.js");
const runtime_js_1 = require("./runtime.js");
const VALID_INTENTS = [
    'action',
    'decision',
    'direction',
    'history',
    'state',
    'story',
    'debug',
    'time_travel',
    'entity',
];
function isWeakDefaultRoute(routed, question) {
    if (routed.intent !== 'history') {
        return false;
    }
    const q = question.trim();
    if (!q || q.length < 8) {
        return true;
    }
    return !/what|why|how|when|history|decision|impact|story|focus|next|module|file|project/i.test(q);
}
async function classifyIntentWithLlm(workspaceRoot, question) {
    const prompt = [
        'Classify this project question into exactly one intent label.',
        'Labels: action, decision, direction, history, state, story, debug, time_travel, entity',
        'Reply with JSON only: {"intent":"...","topic":"optional short topic"}',
        '',
        `Question: ${question}`,
    ].join('\n');
    const out = await (0, runtime_js_1.aiGenerate)(workspaceRoot, 'intent_router', prompt, `intent:${question}`, {
        max_tokens: 80,
        temperature: 0,
    });
    if (!out?.text) {
        return null;
    }
    try {
        const jsonMatch = out.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return null;
        }
        const parsed = JSON.parse(jsonMatch[0]);
        const intent = parsed.intent;
        if (!intent || !VALID_INTENTS.includes(intent)) {
            return null;
        }
        return { intent, topic: parsed.topic?.trim() || undefined, raw: question.trim() };
    }
    catch {
        return null;
    }
}
/**
 * Hybrid intent router — rule first, optional LLM fallback (优化.md).
 * Fact engines unchanged; only routing may use LLM.
 */
async function routeIntent(workspaceRoot, question) {
    const ruled = (0, queryRouter_js_1.routeQuery)(question);
    const config = await (0, config_js_1.readLlmConfig)(workspaceRoot);
    const router = config.intent_router;
    if (!config.enabled || !config.intent_router?.enabled || config.intent_router.mode === 'rule') {
        return ruled;
    }
    if (config.intent_router.mode === 'llm') {
        const llm = await classifyIntentWithLlm(workspaceRoot, question);
        return llm ?? ruled;
    }
    // hybrid
    if (!isWeakDefaultRoute(ruled, question)) {
        return ruled;
    }
    const llm = await classifyIntentWithLlm(workspaceRoot, question);
    return llm ?? ruled;
}
