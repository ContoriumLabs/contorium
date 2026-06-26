"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDecisionCenter = getDecisionCenter;
const decisionConsistency_js_1 = require("./decisionConsistency.js");
const eventStore_js_1 = require("./eventStore.js");
const confidenceLabels_js_1 = require("./confidenceLabels.js");
async function getDecisionCenter(workspaceRoot) {
    const decisions = await (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot);
    const contradictions = (0, decisionConsistency_js_1.detectDecisionContradictions)(decisions);
    const formatted = [
        'Decision Center',
        `${decisions.length} ADR record(s)`,
        ...(contradictions.length ? [`⚠ Conflicts: ${contradictions.length}`, ''] : ['']),
    ];
    for (const c of contradictions.slice(0, 4)) {
        formatted.push(`  · ${c.decision} contradicted by ${c.by}`, `    ${c.reason}`, '');
    }
    for (const adr of decisions.slice(0, 16)) {
        formatted.push(adr.id, '', adr.title, '', `Status: ${adr.status}`, ...(adr.superseded_by ? [`Superseded by: ${adr.superseded_by}`] : []), '', 'Reason:', adr.reason, '', 'Alternatives:', ...adr.alternatives.map((a) => `  · ${a}`), '', `Risk: ${adr.risk}`, `Freshness: ${(0, confidenceLabels_js_1.freshnessLabelText)(adr.freshness)}`, '', '---', '');
    }
    return { decisions, contradictions, formatted };
}
