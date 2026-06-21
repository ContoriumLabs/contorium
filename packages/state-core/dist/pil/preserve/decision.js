"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preserveDecisionNode = preserveDecisionNode;
const decisionLog_js_1 = require("../../intelligence/systems/decisionLog.js");
/** Persist a structured decision node (Preserve layer). */
async function preserveDecisionNode(workspaceRoot, node) {
    return (0, decisionLog_js_1.appendDecisionLogEntry)(workspaceRoot, node);
}
