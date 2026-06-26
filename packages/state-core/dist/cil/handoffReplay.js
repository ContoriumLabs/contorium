"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHandoffReplay = buildHandoffReplay;
const eventStore_js_1 = require("./eventStore.js");
/** P2 — cognitive replay timeline (GitHub Replay for project intelligence). */
async function buildHandoffReplay(workspaceRoot) {
    const [events, adrs] = await Promise.all([
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot),
        (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot),
    ]);
    const stages = [];
    const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const evt of sortedEvents.slice(-24)) {
        stages.push({
            date: evt.timestamp.slice(0, 10),
            label: evt.title,
            detail: evt.why || evt.summary || evt.decision || '',
        });
    }
    for (const adr of adrs.slice(-12)) {
        stages.push({
            date: adr.date.slice(0, 10),
            label: `Decision: ${adr.title}`,
            detail: adr.reason,
        });
    }
    stages.sort((a, b) => a.date.localeCompare(b.date));
    const formatted = ['Handoff Replay — cognitive evolution', ''];
    for (const s of stages) {
        formatted.push(s.date, '', s.label, s.detail ? `  ${s.detail}` : '', '↓', '');
    }
    if (formatted[formatted.length - 1] === '↓') {
        formatted.pop();
    }
    return { stages, formatted };
}
