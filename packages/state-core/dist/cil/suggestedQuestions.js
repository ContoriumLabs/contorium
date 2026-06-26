"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSuggestedQuestions = buildSuggestedQuestions;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const cognitiveHealth_js_1 = require("./cognitiveHealth.js");
const decisionConsistency_js_1 = require("./decisionConsistency.js");
const eventStore_js_1 = require("./eventStore.js");
const impactExplorer_js_1 = require("./impactExplorer.js");
/** Auto-generate top questions for Ask Contorium (onboarding UX). */
async function buildSuggestedQuestions(workspaceRoot) {
    const [events, adrs, state, health] = await Promise.all([
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot),
        (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot),
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, cognitiveHealth_js_1.computeCognitiveHealth)(workspaceRoot).catch(() => null),
    ]);
    const questions = [];
    const mcpEvent = events.find((e) => /mcp/i.test(e.title));
    if (mcpEvent) {
        questions.push('Why was MCP added?');
    }
    else {
        questions.push('Tell me everything about this project');
    }
    const focus = state?.currentTask?.trim();
    if (focus) {
        questions.push(`What is current focus?`);
    }
    else {
        questions.push('What should I do next?');
    }
    const unresolved = adrs.filter((a) => a.status === 'proposed');
    if (unresolved.length) {
        questions.push('Which decisions are unresolved?');
    }
    questions.push('What changed this week?');
    const conflicts = (0, decisionConsistency_js_1.detectDecisionContradictions)(adrs);
    if (conflicts.length) {
        questions.push('Which decisions conflict?');
    }
    if (health && health.score < 85) {
        questions.push('What is cognitive health score?');
    }
    const recentFile = events.find((e) => e.files.length)?.files[0];
    if (recentFile) {
        const mod = recentFile.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') ?? '';
        if (mod.length >= 3) {
            try {
                const blast = await (0, impactExplorer_js_1.getBlastRadius)(workspaceRoot, mod);
                if (blast.blast_radius >= 0.5) {
                    questions.push(`What is highest risk module (${mod})?`);
                }
            }
            catch {
                /* optional */
            }
        }
    }
    const unique = [...new Set(questions)].slice(0, 8);
    return {
        questions: unique,
        formatted: ['Suggested Questions', '', ...unique.map((q, i) => `${i + 1}. ${q}`)],
    };
}
