"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exploreHistory = exploreHistory;
exports.getRecentEvents = getRecentEvents;
exports.getModuleHistory = getModuleHistory;
exports.exploreModuleHistoryFeed = exploreModuleHistoryFeed;
const confidenceLabels_js_1 = require("./confidenceLabels.js");
const eventStore_js_1 = require("./eventStore.js");
const moduleHistory_js_1 = require("./moduleHistory.js");
function rangeBounds(range, now = Date.now()) {
    const to = now;
    const day = 24 * 60 * 60 * 1000;
    switch (range) {
        case 'today':
            return { from: now - day, to };
        case 'yesterday':
            return { from: now - 2 * day, to: now - day };
        case 'last_7_days':
            return { from: now - 7 * day, to };
        case 'last_30_days':
            return { from: now - 30 * day, to };
        case 'all':
        default:
            return { from: 0, to };
    }
}
function formatEventBlock(evt) {
    const date = evt.timestamp.slice(0, 10);
    const lines = [
        date,
        '',
        evt.title,
        '',
    ];
    if (evt.version) {
        lines.push(`Version: ${evt.version}`, '');
    }
    if (evt.why) {
        lines.push('WHY', evt.why, '');
    }
    if (evt.decision) {
        lines.push('DECISION', evt.decision, '');
    }
    if (evt.impact.length) {
        lines.push('IMPACT', ...evt.impact, '');
    }
    if (evt.files.length) {
        lines.push('FILES', ...evt.files.slice(0, 8).map((f) => `  ${f}`), '');
    }
    if (evt.provenance?.length) {
        lines.push('SOURCE', ...evt.provenance.map((p) => `  ${p}`), '');
    }
    lines.push(`Freshness: ${(0, confidenceLabels_js_1.freshnessLabelText)(evt.freshness)}`, '');
    return lines;
}
async function exploreHistory(workspaceRoot, range = 'last_7_days') {
    const all = await (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot);
    const { from, to } = rangeBounds(range);
    const events = all.filter((e) => {
        const ts = Date.parse(e.timestamp);
        return ts >= from && ts <= to;
    });
    const formatted = [`Project History (${range})`, `${events.length} Cognitive Events`, ''];
    for (const evt of events.slice(0, 24)) {
        formatted.push(...formatEventBlock(evt));
    }
    return { range, count: events.length, events, formatted };
}
async function getRecentEvents(workspaceRoot, limit = 10) {
    const all = await (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot);
    return all.slice(0, limit);
}
async function getModuleHistory(workspaceRoot, modulePath, limit = 20) {
    const all = await (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot);
    return (0, moduleHistory_js_1.filterEventsByModule)(all, modulePath).slice(0, limit);
}
async function exploreModuleHistoryFeed(workspaceRoot, module) {
    const all = await (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot);
    const result = await (0, moduleHistory_js_1.exploreModuleHistory)(workspaceRoot, module, all);
    return { module: result.module, formatted: result.formatted };
}
