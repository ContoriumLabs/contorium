"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStructuredResponse = buildStructuredResponse;
exports.kernelOutputToAskResult = kernelOutputToAskResult;
function buildStructuredResponse(output) {
    const result = output.result;
    const facts = [];
    const insights = [];
    const actions = [];
    if (typeof result?.answer === 'string') {
        facts.push(String(result.answer));
    }
    if (Array.isArray(result?.events)) {
        for (const e of result.events) {
            if (e.title) {
                facts.push(`${e.timestamp?.slice(0, 10) ?? ''}: ${e.title}`.trim());
            }
        }
    }
    if (result?.decision || result?.why) {
        insights.push(String(result.why ?? result.decision ?? ''));
    }
    if (output.intent === 'direction' && typeof result?.pik_summary === 'string') {
        insights.push(String(result.pik_summary));
    }
    if (result?.alignment_score != null) {
        insights.push(`Alignment ${Math.round(Number(result.alignment_score) * 100)}%`);
    }
    if (Array.isArray(result?.next_actions)) {
        actions.push(...result.next_actions);
    }
    if (output.intent === 'action' && Array.isArray(result?.items)) {
        actions.push(...result.items);
    }
    return { fact: facts.slice(0, 12), insight: insights.slice(0, 8), actions: actions.slice(0, 8) };
}
function kernelOutputToAskResult(query, output) {
    const result = output.result;
    const answer = (typeof result?.answer === 'string' && result.answer) ||
        (typeof result?.summary === 'string' && result.summary) ||
        output.intent;
    return {
        question: query,
        intent: output.intent,
        answer,
        data: result,
        structured: buildStructuredResponse(output),
        trace: output.trace,
    };
}
