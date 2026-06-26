"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStoryPrompt = buildStoryPrompt;
exports.buildEssencePrompt = buildEssencePrompt;
exports.buildDnaPrompt = buildDnaPrompt;
exports.buildAskEnhancePrompt = buildAskEnhancePrompt;
function buildStoryPrompt(ruleMarkdown) {
    return [
        'Rewrite the following project story as a cohesive narrative for a developer joining the project.',
        'Keep all factual content. Use markdown headings. Do not add fictional milestones.',
        '',
        ruleMarkdown,
    ].join('\n');
}
function buildEssencePrompt(ruleMarkdown) {
    return [
        'Compress the following project essence into a tighter summary (~200–400 words).',
        'Preserve decisions, focus, and risks. Markdown output.',
        '',
        ruleMarkdown,
    ].join('\n');
}
function buildDnaPrompt(ruleText) {
    return [
        'Turn this project DNA fingerprint into a concise identity paragraph for AI handoff.',
        'Keep architecture, memory model, interaction layer, state model, and goal accurate.',
        '',
        ruleText,
    ].join('\n');
}
function buildAskEnhancePrompt(input) {
    const lines = [
        'Improve this Contorium answer for clarity while preserving all facts.',
        '2–5 sentences. No new decisions or file names.',
        '',
        `Question: ${input.question}`,
        `Rule-based answer: ${input.ruleAnswer}`,
    ];
    if (input.facts?.length) {
        lines.push('', 'Supporting facts:', ...input.facts.map((f) => `- ${f}`));
    }
    return lines.join('\n');
}
