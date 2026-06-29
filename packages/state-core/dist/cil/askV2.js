"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareAskV2Context = prepareAskV2Context;
exports.buildDirectionKernelOutput = buildDirectionKernelOutput;
exports.appendAlignmentNote = appendAlignmentNote;
const generator_js_1 = require("./pik/generator.js");
const fusion_js_1 = require("./semantic/fusion.js");
const directionQuery_js_1 = require("./semantic/directionQuery.js");
function traceStep(engine, phase) {
    return { engine, phase, at: new Date().toISOString() };
}
async function prepareAskV2Context(workspaceRoot, question) {
    const pik = await (0, generator_js_1.ensureProjectIntentKernel)(workspaceRoot);
    const fusion = await (0, fusion_js_1.fuseSemanticContext)(workspaceRoot, question, pik);
    return {
        pik,
        fusion,
        isDirection: (0, directionQuery_js_1.isDirectionQuery)(question),
        isDrift: (0, directionQuery_js_1.isDriftQuery)(question),
    };
}
/** PIK-first answer for direction / identity / drift questions. */
function buildDirectionKernelOutput(question, ctx) {
    const { pik, fusion, isDrift } = ctx;
    const trace = [
        traceStep('pik', 'load'),
        traceStep('semantic_fusion', 'fuse'),
        traceStep('ask_v2', isDrift ? 'drift_answer' : 'direction_answer'),
    ];
    const goalLines = pik.goal_hierarchy.map((g) => `- ${g.goal} (${Math.round(g.weight * 100)}%)`);
    const lines = [
        `**Project:** ${pik.project_identity.name} — ${pik.project_identity.type}`,
        '',
        `**Core direction (PIK):** ${pik.primary_intent.statement}`,
        '',
    ];
    if (goalLines.length) {
        lines.push('**Goal hierarchy:**', ...goalLines, '');
    }
    if (pik.constraints.length) {
        lines.push('**Constraints:**', ...pik.constraints.map((c) => `- ${c}`), '');
    }
    if (pik.non_goals.length) {
        lines.push('**Non-goals:**', ...pik.non_goals.map((n) => `- ${n}`), '');
    }
    if (fusion.current_focus) {
        lines.push(`**Current focus:** ${fusion.current_focus}`, '');
    }
    lines.push(`**Alignment:** ${Math.round(fusion.current_alignment_score * 100)}% · Drift ${fusion.drift.severity} (${fusion.drift.drift_type})`, fusion.drift.explanation, '');
    if (isDrift && fusion.recommended_next_focus.length) {
        lines.push('**Goal-aligned next steps:**', ...fusion.recommended_next_focus.map((t) => `- ${t}`), '');
    }
    lines.push('_Direction comes from PIK (`.contora/intent/kernel.json`). Events and ADRs support but do not define project direction._');
    return {
        intent: 'direction',
        result: {
            answer: lines.join('\n'),
            fusion,
            pik_summary: pik.primary_intent.statement,
            alignment_score: fusion.current_alignment_score,
            drift: fusion.drift,
        },
        trace,
    };
}
/** Append alignment note when drift is significant on non-direction queries. */
function appendAlignmentNote(answer, fusion) {
    if (fusion.drift.severity === 'LOW') {
        return answer;
    }
    return `${answer}\n\n**Alignment note:** ${fusion.drift.explanation} (score ${Math.round(fusion.current_alignment_score * 100)}%)`;
}
