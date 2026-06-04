"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveKnowledgeRebuildTrigger = resolveKnowledgeRebuildTrigger;
exports.shouldRebuildKnowledgeGraph = shouldRebuildKnowledgeGraph;
const closureConstants_js_1 = require("./closureConstants.js");
/** When to rebuild knowledge.json (Closure §9.3). */
function resolveKnowledgeRebuildTrigger(input) {
    if (input.isInitial) {
        return 'initial';
    }
    if (input.hasNewCommit) {
        return 'git_commit';
    }
    if (input.changedFileCount >= closureConstants_js_1.REBUILD_FILE_THRESHOLD) {
        return 'file_batch';
    }
    if (input.intentChanged) {
        return 'intent_change';
    }
    if (input.lastBuildAt != null && input.now - input.lastBuildAt >= closureConstants_js_1.REBUILD_IDLE_MS) {
        return 'idle';
    }
    return 'change';
}
function shouldRebuildKnowledgeGraph(input) {
    if (input.isInitial || !input.lastBuildAt) {
        return true;
    }
    const trigger = resolveKnowledgeRebuildTrigger(input);
    if (trigger === 'idle' && input.changedFileCount === 0) {
        return true;
    }
    return input.changedFileCount > 0 || input.intentChanged || !!input.hasNewCommit;
}
