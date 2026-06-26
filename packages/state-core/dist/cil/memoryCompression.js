"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProjectEssence = buildProjectEssence;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const intentVNext_js_1 = require("../intelligence/intentVNext.js");
const cognitiveHealth_js_1 = require("./cognitiveHealth.js");
const decisionConsistency_js_1 = require("./decisionConsistency.js");
const eventStore_js_1 = require("./eventStore.js");
const journeyBuilder_js_1 = require("./journeyBuilder.js");
/** P2 — compress long project memory into Project Essence for AI transfer. */
async function buildProjectEssence(workspaceRoot) {
    const [events, adrs, state, intents, journey, health] = await Promise.all([
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot),
        (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot),
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
        (0, journeyBuilder_js_1.buildProjectJourney)(workspaceRoot),
        (0, cognitiveHealth_js_1.computeCognitiveHealth)(workspaceRoot),
    ]);
    const phases = journey.stages.map((s) => s.label).slice(0, 6);
    const keyDecisions = adrs
        .filter((a) => a.status === 'accepted' || a.status === 'proposed')
        .slice(0, 8)
        .map((a) => a.title);
    const currentFocus = state?.currentTask?.trim() ||
        intents?.nodes?.[0]?.name ||
        'Not set';
    const conflicts = (0, decisionConsistency_js_1.detectDecisionContradictions)(adrs);
    const openRisks = [
        ...health.warnings.filter((w) => w.severity !== 'low').map((w) => w.message),
        ...conflicts.map((c) => `Decision conflict: ${c.decision_title} vs ${c.by_title}`),
    ].slice(0, 6);
    const lines = [
        '# Project Essence',
        '',
        `This project evolved through ${phases.length || 1} major phase(s).`,
        '',
        '## Key decisions',
        ...keyDecisions.map((d) => `- ${d}`),
        '',
        '## Current focus',
        `- ${currentFocus}`,
        '',
        '## Recent activity',
        ...events.slice(0, 5).map((e) => `- ${e.timestamp.slice(0, 10)}: ${e.title}`),
        '',
        '## Open risks',
        ...(openRisks.length ? openRisks.map((r) => `- ${r}`) : ['- None flagged']),
        '',
        `Cognitive health: ${health.score}%`,
    ];
    return {
        phases,
        key_decisions: keyDecisions,
        current_focus: currentFocus,
        open_risks: openRisks,
        formatted_markdown: lines.join('\n'),
    };
}
