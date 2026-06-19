"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preActionCheck = exports.updateCognitiveFromInput = void 0;
exports.analyzeProject = analyzeProject;
exports.validateChange = validateChange;
exports.getProjectState = getProjectState;
exports.refreshProjectCognitive = refreshProjectCognitive;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const store_js_1 = require("../understanding/store.js");
const cognitiveProjection_js_1 = require("./cognitiveProjection.js");
const cognitiveLoop_js_1 = require("./cognitiveLoop.js");
Object.defineProperty(exports, "updateCognitiveFromInput", { enumerable: true, get: function () { return cognitiveLoop_js_1.updateCognitiveFromInput; } });
const executionGuard_js_1 = require("./executionGuard.js");
Object.defineProperty(exports, "preActionCheck", { enumerable: true, get: function () { return executionGuard_js_1.preActionCheck; } });
const governanceEngine_js_1 = require("./governanceEngine.js");
const store_js_2 = require("./store.js");
/** V3.2 internal API — not HTTP; shared by MCP / CLI / IDE adapters. */
async function analyzeProject(workspaceRoot) {
    const resolved = workspaceRoot;
    const [governance, state, intent, handoff] = await Promise.all([
        (0, governanceEngine_js_1.getGovernanceSummary)(resolved),
        (0, store_js_2.readCognitiveState)(resolved),
        (0, store_js_2.readCognitiveIntent)(resolved),
        (0, store_js_1.readHandoffArtifact)(resolved),
    ]);
    return {
        workspaceRoot: resolved,
        governance,
        cognitive: { state, intent },
        handoff: {
            goal: handoff?.goal,
            current_focus: handoff?.current_focus,
            risk: handoff?.impact_summary?.risk,
        },
    };
}
async function validateChange(workspaceRoot, input) {
    return (0, executionGuard_js_1.preActionCheck)(workspaceRoot, input);
}
async function getProjectState(workspaceRoot) {
    const [bootstrap, cognitive, intent, bundle, changeLog] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, store_js_2.readCognitiveState)(workspaceRoot),
        (0, store_js_2.readCognitiveIntent)(workspaceRoot),
        (0, governanceEngine_js_1.loadGovernanceBundle)(workspaceRoot),
        (0, store_js_2.readChangeLog)(workspaceRoot),
    ]);
    return {
        workspaceRoot,
        bootstrap,
        cognitive,
        intent,
        governance_ready: !!bundle,
        recent_guard_checks: changeLog?.records?.length ?? 0,
    };
}
async function refreshProjectCognitive(workspaceRoot) {
    const state = await (0, bootstrapState_js_1.readStateJson)(workspaceRoot);
    await (0, cognitiveProjection_js_1.syncCognitiveLayer)(workspaceRoot, state);
}
