"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askProject = askProject;
exports.getProjectStory = getProjectStory;
exports.getProjectStoryLegacy = getProjectStoryLegacy;
const formatter_js_1 = require("./formatter.js");
const kernel_js_1 = require("./kernel.js");
const index_js_1 = require("../ai/generators/index.js");
const historyExplorer_js_1 = require("./historyExplorer.js");
const decisionCenter_js_1 = require("./decisionCenter.js");
const journeyBuilder_js_1 = require("./journeyBuilder.js");
const store_js_1 = require("../understanding/store.js");
const askV2_js_1 = require("./askV2.js");
function toSemanticBundle(fusion, pikSource) {
    return {
        primary_intent: fusion.primary_intent_statement,
        alignment_score: fusion.current_alignment_score,
        drift: fusion.drift,
        recommended_next_focus: fusion.recommended_next_focus,
        pik_source: pikSource,
        reasoning_trace: fusion.reasoning_trace,
    };
}
/** Ask Contorium v2 — PIK + semantic fusion, then cognitive kernel. */
async function askProject(workspaceRoot, question) {
    const ctx = await (0, askV2_js_1.prepareAskV2Context)(workspaceRoot, question);
    const semantic = toSemanticBundle(ctx.fusion, ctx.pik.source);
    if (ctx.isDirection || ctx.isDrift) {
        const output = (0, askV2_js_1.buildDirectionKernelOutput)(question, ctx);
        return {
            ...(0, formatter_js_1.kernelOutputToAskResult)(question, output),
            semantic,
        };
    }
    const output = await (0, kernel_js_1.runCognitiveKernel)(workspaceRoot, { mode: 'ask', query: question });
    let base = (0, formatter_js_1.kernelOutputToAskResult)(question, output);
    base = {
        ...base,
        answer: (0, askV2_js_1.appendAlignmentNote)(base.answer, ctx.fusion),
        semantic,
    };
    if (output.intent === 'decision') {
        const result = base.data;
        const center = await (0, decisionCenter_js_1.getDecisionCenter)(workspaceRoot);
        const llmWhy = await (0, index_js_1.generateWhyExplanation)(workspaceRoot, {
            question,
            decision: String(result?.decision ?? ''),
            reason: String(result?.why ?? result?.answer ?? ''),
            date: result?.date ? String(result.date) : undefined,
            adrs: center.decisions.slice(0, 4).map((d) => `${d.title}: ${d.reason}`),
        });
        if (llmWhy) {
            base = {
                ...base,
                answer: (0, askV2_js_1.appendAlignmentNote)(llmWhy, ctx.fusion),
                data: { ...result, answer: llmWhy, llm_enhanced: true },
                trace: [...(base.trace ?? []), { engine: 'ai_layer', phase: 'why', at: new Date().toISOString() }],
                semantic,
            };
            return base;
        }
        return base;
    }
    const enhanced = await (0, index_js_1.enhanceAskAnswer)(workspaceRoot, question, base.answer, base.structured?.fact);
    if (enhanced) {
        return { ...base, answer: (0, askV2_js_1.appendAlignmentNote)(enhanced, ctx.fusion), semantic };
    }
    return base;
}
async function getProjectStory(workspaceRoot) {
    const output = await (0, kernel_js_1.runCognitiveKernel)(workspaceRoot, { mode: 'story' });
    const story = output.result;
    const formatted = story.formatted_markdown?.split('\n') ?? [story.project_summary ?? ''];
    return { story: formatted.join('\n'), formatted };
}
/** @deprecated prefer runCognitiveKernel — kept for legacy callers */
async function getProjectStoryLegacy(workspaceRoot) {
    const [history, center, journey, handoff] = await Promise.all([
        (0, historyExplorer_js_1.exploreHistory)(workspaceRoot, 'last_7_days'),
        (0, decisionCenter_js_1.getDecisionCenter)(workspaceRoot),
        (0, journeyBuilder_js_1.buildProjectJourney)(workspaceRoot),
        (0, store_js_1.readHandoffArtifact)(workspaceRoot),
    ]);
    const formatted = [
        'Project Story',
        '',
        handoff?.goal ? `Goal: ${handoff.goal}` : '',
        '',
        `Recent events: ${history.count}`,
        ...history.formatted.slice(0, 12),
        '',
        ...center.formatted.slice(0, 16),
        '',
        ...journey.formatted.slice(0, 12),
    ].filter(Boolean);
    return { story: formatted.join('\n'), formatted };
}
