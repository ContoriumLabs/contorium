"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWhyExplanation = generateWhyExplanation;
exports.generateStoryWithAi = generateStoryWithAi;
exports.generateEssenceWithAi = generateEssenceWithAi;
exports.generateDnaWithAi = generateDnaWithAi;
exports.enhanceAskAnswer = enhanceAskAnswer;
const transferStory_js_1 = require("../../cil/transferStory.js");
const memoryCompression_js_1 = require("../../cil/memoryCompression.js");
const projectDna_js_1 = require("../../cil/projectDna.js");
const runtime_js_1 = require("../runtime.js");
const why_js_1 = require("../prompts/why.js");
const narrative_js_1 = require("../prompts/narrative.js");
async function generateWhyExplanation(workspaceRoot, input) {
    const prompt = (0, why_js_1.buildWhyPrompt)(input);
    const out = await (0, runtime_js_1.aiGenerate)(workspaceRoot, 'why', prompt, `why:${input.question}`);
    return out?.text ?? null;
}
async function generateStoryWithAi(workspaceRoot) {
    const rule = await (0, transferStory_js_1.buildTransferStory)(workspaceRoot);
    const out = await (0, runtime_js_1.aiGenerate)(workspaceRoot, 'story', (0, narrative_js_1.buildStoryPrompt)(rule.formatted_markdown), 'story:v1');
    if (!out?.text) {
        return rule;
    }
    return {
        ...rule,
        formatted_markdown: out.text,
        project_summary: out.text.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ?? rule.project_summary,
        llm_enhanced: true,
    };
}
async function generateEssenceWithAi(workspaceRoot) {
    const rule = await (0, memoryCompression_js_1.buildProjectEssence)(workspaceRoot);
    const md = rule.formatted_markdown ?? '';
    const out = await (0, runtime_js_1.aiGenerate)(workspaceRoot, 'essence', (0, narrative_js_1.buildEssencePrompt)(md), 'essence:v1');
    if (!out?.text) {
        return rule;
    }
    return { ...rule, formatted_markdown: out.text, llm_enhanced: true };
}
async function generateDnaWithAi(workspaceRoot) {
    const rule = await (0, projectDna_js_1.buildProjectDna)(workspaceRoot);
    const text = rule.formatted?.join('\n') ?? '';
    const out = await (0, runtime_js_1.aiGenerate)(workspaceRoot, 'dna', (0, narrative_js_1.buildDnaPrompt)(text), 'dna:v1');
    if (!out?.text) {
        return rule;
    }
    return { ...rule, formatted: out.text.split('\n'), llm_enhanced: true };
}
async function enhanceAskAnswer(workspaceRoot, question, ruleAnswer, facts) {
    const prompt = (0, narrative_js_1.buildAskEnhancePrompt)({ question, ruleAnswer, facts });
    const out = await (0, runtime_js_1.aiGenerate)(workspaceRoot, 'ask_enhance', prompt, `ask:${question}:${ruleAnswer.slice(0, 80)}`);
    return out?.text ?? null;
}
