"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preserveStateJson = preserveStateJson;
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
/** Persist workspace state.json with adapter metadata (Preserve layer). */
async function preserveStateJson(workspaceRoot, state, writer) {
    await (0, bootstrapState_js_1.writeStateJson)(workspaceRoot, state, { mode: 'event-driven', writer });
}
