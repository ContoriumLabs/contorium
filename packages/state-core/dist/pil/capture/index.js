"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureProjectFocus = captureProjectFocus;
exports.captureProjectNote = captureProjectNote;
exports.captureProjectDecision = captureProjectDecision;
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
const decision_js_1 = require("../structure/decision.js");
const decision_js_2 = require("../preserve/decision.js");
const state_js_1 = require("../preserve/state.js");
function emptyState() {
    return {
        sessionId: `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        currentTask: '',
        openFiles: [],
        recentFiles: [],
        gitStaged: [],
        gitWorking: [],
        notes: '',
        lastUpdated: Date.now(),
    };
}
/** PIL Capture — persist current project focus. */
async function captureProjectFocus(workspaceRoot, focus, writer = 'cli') {
    const trimmed = focus.trim();
    if (!trimmed) {
        throw new Error('focus is required');
    }
    const state = (await (0, bootstrapState_js_1.readStateJson)(workspaceRoot)) ?? emptyState();
    state.currentTask = trimmed;
    state.lastUpdated = Date.now();
    await (0, state_js_1.preserveStateJson)(workspaceRoot, state, writer);
    return {
        workspaceRoot,
        captured: 'focus',
        focus: trimmed,
        lastUpdated: state.lastUpdated,
    };
}
/** PIL Capture — append a timestamped project note. */
async function captureProjectNote(workspaceRoot, text, writer = 'cli') {
    const trimmed = text.trim();
    if (!trimmed) {
        throw new Error('text is required');
    }
    const state = (await (0, bootstrapState_js_1.readStateJson)(workspaceRoot)) ?? emptyState();
    const stamp = new Date().toISOString();
    const line = `[${stamp}] ${trimmed}`;
    state.notes = state.notes.trim() ? `${state.notes.trim()}\n${line}` : line;
    state.lastUpdated = Date.now();
    await (0, state_js_1.preserveStateJson)(workspaceRoot, state, writer);
    return {
        workspaceRoot,
        captured: 'note',
        line,
        lastUpdated: state.lastUpdated,
    };
}
/** PIL Capture — record a decision (Structure → Preserve). */
async function captureProjectDecision(workspaceRoot, input) {
    const selected = input.selected.trim();
    if (!selected) {
        throw new Error('selected is required');
    }
    const node = (0, decision_js_1.structureDecisionNode)(input);
    const log = await (0, decision_js_2.preserveDecisionNode)(workspaceRoot, node);
    return {
        workspaceRoot,
        captured: 'decision',
        decision_id: node.decision_id,
        selected,
        log_entries: log.entries.length,
    };
}
