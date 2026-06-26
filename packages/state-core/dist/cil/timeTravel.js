"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryTimeTravel = queryTimeTravel;
const eventStore_js_1 = require("./eventStore.js");
const snapshotEngine_js_1 = require("./snapshotEngine.js");
function onOrBefore(isoDate, targetDate) {
    return isoDate.slice(0, 10) <= targetDate.slice(0, 10);
}
/**
 * Time Travel Query — two perspectives:
 * - historical: what we knew ON that date
 * - retrospective: what we know NOW about that date (superseded ADRs annotated)
 */
async function queryTimeTravel(workspaceRoot, dateStr, options = {}) {
    const perspective = options.perspective ?? 'historical';
    const date = dateStr.slice(0, 10);
    const snapshot = await (0, snapshotEngine_js_1.findSnapshotByDate)(workspaceRoot, date);
    const [allEvents, allAdrsCurrent] = await Promise.all([
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot),
        (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot),
    ]);
    let events = perspective === 'historical' && snapshot?.events?.length
        ? snapshot.events
        : allEvents.filter((e) => onOrBefore(e.timestamp, date)).slice(0, 24);
    let decisions = perspective === 'historical' && snapshot?.decisions?.length
        ? snapshot.decisions
        : allAdrsCurrent.filter((a) => onOrBefore(a.date, date));
    const retrospective_notes = [];
    if (perspective === 'retrospective') {
        decisions = allAdrsCurrent.filter((a) => onOrBefore(a.date, date));
        for (const adr of decisions) {
            if (adr.superseded_by) {
                const repl = allAdrsCurrent.find((a) => a.id === adr.superseded_by);
                retrospective_notes.push(`${adr.id} (${adr.title}) — now known superseded by ${adr.superseded_by}${repl ? `: ${repl.title}` : ''}`);
            }
            if (adr.status === 'rejected' || adr.status === 'deprecated') {
                retrospective_notes.push(`${adr.id} — current status: ${adr.status}`);
            }
        }
        events = allEvents
            .filter((e) => onOrBefore(e.timestamp, date))
            .map((e) => {
            const current = allEvents.find((c) => c.id === e.id);
            if (current && current.freshness !== e.freshness) {
                retrospective_notes.push(`Event ${e.id}: freshness updated since ${date}`);
            }
            return current ?? e;
        })
            .slice(0, 24);
    }
    const focus = (perspective === 'historical' ? snapshot?.state.current_task : undefined)?.trim() ||
        snapshot?.state.focus?.trim() ||
        events.find((e) => e.title && e.provenance?.includes('focus_note'))?.title ||
        (perspective === 'retrospective'
            ? allEvents.find((e) => e.provenance?.includes('focus_note') && onOrBefore(e.timestamp, date))?.title
            : undefined);
    const formatted = [
        `Time Travel — ${date} (${perspective})`,
        perspective === 'historical'
            ? 'Perspective: what we knew ON this date'
            : 'Perspective: what we know NOW about this date',
        '',
        `Focus: ${focus ?? '(not recorded)'}`,
        '',
        `Snapshot: ${snapshot ? snapshot.id : 'none nearest this date'}`,
        ...(snapshot ? [`Summary: ${snapshot.summary}`, ''] : []),
    ];
    if (retrospective_notes.length) {
        formatted.push('Retrospective notes:', ...retrospective_notes.slice(0, 8).map((n) => `  · ${n}`), '');
    }
    formatted.push(`Decisions (${decisions.length}):`, ...decisions.slice(0, 8).map((d) => {
        const sup = d.superseded_by && perspective === 'retrospective' ? ` → superseded by ${d.superseded_by}` : '';
        return `  · ${d.id}: ${d.title} [${d.status}]${sup}`;
    }), '', `Events (${events.length}):`, ...events.slice(0, 10).map((e) => `  · ${e.timestamp.slice(0, 10)}: ${e.title}`));
    return {
        date,
        perspective,
        snapshot,
        focus,
        decisions,
        events,
        retrospective_notes: retrospective_notes.length ? retrospective_notes : undefined,
        formatted,
    };
}
