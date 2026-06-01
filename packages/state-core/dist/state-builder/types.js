"use strict";
/** State Builder — AI-agnostic project state (`.contora/state-builder/project-state.json`). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_BUILT_STATE_VERSION = void 0;
exports.emptyProjectBuiltState = emptyProjectBuiltState;
exports.PROJECT_BUILT_STATE_VERSION = 1;
function emptyProjectBuiltState(now = Date.now()) {
    return {
        version: exports.PROJECT_BUILT_STATE_VERSION,
        generatedAt: now,
        project_goal: '',
        current_stage: '',
        active_modules: [],
        recent_decisions: [],
        open_problems: [],
        completed_milestones: [],
        next_actions: [],
        confidence: 0,
    };
}
