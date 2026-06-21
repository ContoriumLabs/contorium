"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECISION_LOG_SCHEMA = void 0;
exports.readDecisionLog = readDecisionLog;
exports.appendDecisionLogEntry = appendDecisionLogEntry;
const paths_js_1 = require("../paths.js");
const io_js_1 = require("../dimensions/io.js");
exports.DECISION_LOG_SCHEMA = 'decision_log.v1';
async function readDecisionLog(workspaceRoot) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.decisionLogPath)(workspaceRoot));
    if (raw?.schema === exports.DECISION_LOG_SCHEMA && Array.isArray(raw.entries)) {
        return raw;
    }
    return null;
}
async function appendDecisionLogEntry(workspaceRoot, node) {
    const existing = (await readDecisionLog(workspaceRoot)) ?? {
        schema: exports.DECISION_LOG_SCHEMA,
        updated_at: new Date().toISOString(),
        entries: [],
    };
    const entry = {
        decision_id: node.decision_id,
        intent_id: node.linked_intent,
        selected: node.selected,
        reason: node.reason,
        impact: node.impact_scope,
        created_at: node.timestamp,
    };
    const entries = [
        ...existing.entries.filter((e) => e.decision_id !== entry.decision_id),
        entry,
    ].slice(-128);
    const artifact = {
        schema: exports.DECISION_LOG_SCHEMA,
        updated_at: new Date().toISOString(),
        entries,
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.decisionLogPath)(workspaceRoot), artifact);
    return artifact;
}
