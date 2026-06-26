"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProjectDna = buildProjectDna;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const intentVNext_js_1 = require("../intelligence/intentVNext.js");
const store_js_1 = require("../understanding/store.js");
const cognitiveHealth_js_1 = require("./cognitiveHealth.js");
const eventStore_js_1 = require("./eventStore.js");
/** Project DNA — stable identity fingerprint for AI handoff. */
async function buildProjectDna(workspaceRoot) {
    const [state, intents, handoff, adrs, health] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
        (0, store_js_1.readHandoffArtifact)(workspaceRoot),
        (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot),
        (0, cognitiveHealth_js_1.computeCognitiveHealth)(workspaceRoot).catch(() => null),
    ]);
    const architecture = adrs.find((a) => /mcp|architecture|runtime|first/i.test(a.title))?.title ??
        adrs[0]?.title ??
        'Not recorded';
    const memory = adrs.find((a) => /pil|intelligence|memory|storage/i.test(a.title))?.title ?? 'AI PIL';
    const interaction = 'CIL (Cognitive Interaction Layer)';
    const stateModel = adrs.find((a) => /event|snapshot|state engine/i.test(a.title))?.title ?? 'Event-driven projections';
    const goal = handoff?.goal?.trim() ||
        intents?.nodes?.[0]?.name ||
        state?.currentTask?.trim() ||
        'Cross-agent project intelligence';
    const formatted = [
        'Project DNA',
        '',
        `Architecture: ${architecture}`,
        `Memory: ${memory}`,
        `Interaction: ${interaction}`,
        `State: ${stateModel}`,
        `Goal: ${goal}`,
        '',
        `Cognitive health: ${health?.score ?? '—'}%`,
    ];
    return {
        architecture,
        memory,
        interaction,
        state: stateModel,
        goal,
        formatted,
        formatted_markdown: [
            '# Project DNA',
            '',
            `- **Architecture:** ${architecture}`,
            `- **Memory:** ${memory}`,
            `- **Interaction:** ${interaction}`,
            `- **State:** ${stateModel}`,
            `- **Goal:** ${goal}`,
            '',
            `Cognitive health: ${health?.score ?? '—'}%`,
        ].join('\n'),
    };
}
