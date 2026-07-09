"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichDecisionAskAnswer = enrichDecisionAskAnswer;
exports.extractDecisionRefsFromAskResult = extractDecisionRefsFromAskResult;
const eventStore_js_1 = require("../cil/eventStore.js");
const engine_js_1 = require("./engine.js");
const store_js_1 = require("./store.js");
/** Lifecycle filter — enrich decision Ask answers with trust metadata (优化.md §11). */
async function enrichDecisionAskAnswer(workspaceRoot, baseAnswer, match, topic) {
    let index = await (0, store_js_1.readKnowledgeLifecycle)(workspaceRoot);
    if (!index?.decisions.length) {
        index = await (0, engine_js_1.computeKnowledgeLifecycle)(workspaceRoot);
    }
    const needle = match?.id ?? match?.title ?? topic ?? '';
    const record = needle ? (0, engine_js_1.findDecisionLifecycle)(index, needle) : index.decisions[0];
    if (!record) {
        return { answer: baseAnswer };
    }
    const adrs = await (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot);
    const trustBlock = (0, engine_js_1.formatDecisionLifecycleAnswer)(record, adrs);
    return {
        answer: `${baseAnswer}\n\n---\n\n## Knowledge trust (Lifecycle)\n\n${trustBlock}`,
        lifecycle: record,
    };
}
/** Extract decision ids/titles referenced in kernel structured results (for lifecycle filtering). */
function extractDecisionRefsFromAskResult(intent, data) {
    if (!data) {
        return [];
    }
    const refs = new Set();
    if (intent === 'history' && Array.isArray(data.events)) {
        for (const raw of data.events) {
            if (!raw || typeof raw !== 'object') {
                continue;
            }
            const ev = raw;
            if (typeof ev.linked_decision_id === 'string') {
                refs.add(ev.linked_decision_id);
            }
            if (typeof ev.decision === 'string') {
                refs.add(ev.decision);
            }
            if (typeof ev.title === 'string' && ev.title.length >= 4) {
                refs.add(ev.title);
            }
        }
    }
    if (intent === 'action' && Array.isArray(data.items)) {
        for (const raw of data.items) {
            if (!raw || typeof raw !== 'object') {
                continue;
            }
            const item = raw;
            if (typeof item.decision_ref === 'string') {
                refs.add(item.decision_ref);
            }
            const task = typeof item.task === 'string' ? item.task : '';
            const m = task.match(/decision:\s*(.+)/i);
            if (m?.[1]) {
                refs.add(m[1].trim());
            }
        }
    }
    if (intent === 'entity') {
        const record = data.record;
        if (record && Array.isArray(record.decisions)) {
            for (const d of record.decisions) {
                if (typeof d === 'string') {
                    refs.add(d);
                }
            }
        }
    }
    if (intent === 'state' && Array.isArray(data.review_queue)) {
        for (const raw of data.review_queue) {
            if (!raw || typeof raw !== 'object') {
                continue;
            }
            const item = raw;
            if (typeof item.decision_id === 'string') {
                refs.add(item.decision_id);
            }
            if (typeof item.title === 'string') {
                refs.add(item.title);
            }
        }
    }
    return [...refs];
}
