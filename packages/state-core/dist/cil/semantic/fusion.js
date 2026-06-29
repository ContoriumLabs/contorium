"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fuseSemanticContext = fuseSemanticContext;
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
const intentVNext_js_1 = require("../../intelligence/intentVNext.js");
const store_js_1 = require("../../understanding/store.js");
const actionEngine_js_1 = require("../actionEngine.js");
const decisionCenter_js_1 = require("../decisionCenter.js");
const eventStore_js_1 = require("../eventStore.js");
const drift_js_1 = require("../pik/drift.js");
const directionQuery_js_1 = require("./directionQuery.js");
function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}
function tokenOverlap(a, b) {
    const ta = new Set(a.toLowerCase().split(/[^\w]+/).filter((t) => t.length > 3));
    const tb = new Set(b.toLowerCase().split(/[^\w]+/).filter((t) => t.length > 3));
    if (ta.size === 0 || tb.size === 0) {
        return 0;
    }
    let hit = 0;
    for (const t of ta) {
        if (tb.has(t)) {
            hit += 1;
        }
    }
    return hit / Math.max(ta.size, tb.size);
}
async function fuseSemanticContext(workspaceRoot, question, pik) {
    const trace = ['load_pik'];
    const sources = ['.contora/intent/kernel.json (PIK)'];
    const [state, handoff, intents, events, center, actions] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, store_js_1.readHandoffArtifact)(workspaceRoot),
        (0, intentVNext_js_1.readIntentNodesVNext)(workspaceRoot),
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot),
        (0, decisionCenter_js_1.getDecisionCenter)(workspaceRoot),
        (0, actionEngine_js_1.deriveNextActions)(workspaceRoot),
    ]);
    sources.push('.contora/state.json', '.contora/understanding/handoff.json', '.contora/intelligence/intent_nodes.json', '.contora/cognitive/events/', '.contora/cognitive/adrs/');
    trace.push('merge_pil_cil');
    const currentFocus = handoff?.current_focus?.trim() || state?.currentTask?.trim() || handoff?.goal?.trim() || undefined;
    const drift = await (0, drift_js_1.detectProjectDrift)(workspaceRoot, pik);
    trace.push('drift_detection');
    const alignFocus = currentFocus ? tokenOverlap(currentFocus, pik.primary_intent.statement) : 0.5;
    const alignGoals = pik.goal_hierarchy.length > 0
        ? pik.goal_hierarchy.reduce((s, g) => s + g.weight * (currentFocus ? tokenOverlap(currentFocus, g.goal) : 0.5), 0)
        : 0.5;
    const current_alignment_score = clamp01(1 - drift.drift_score * 0.6 + alignFocus * 0.25 + alignGoals * 0.15);
    const recommended_next_focus = actions.slice(0, 4).map((a) => a.task);
    const project_core_direction = [
        pik.primary_intent.statement,
        pik.goal_hierarchy.length
            ? `Goals: ${pik.goal_hierarchy
                .slice(0, 3)
                .map((g) => g.goal)
                .join(' · ')}`
            : '',
        currentFocus ? `Current focus: ${currentFocus}` : '',
        intents[0]?.title ? `Intent node: ${intents[0].title}` : '',
        center.decisions[0]?.title ? `Latest decision: ${center.decisions[0].title}` : '',
    ]
        .filter(Boolean)
        .join('\n');
    if ((0, directionQuery_js_1.isDirectionQuery)(question)) {
        trace.push('direction_query_pik_priority');
    }
    if ((0, directionQuery_js_1.isDriftQuery)(question)) {
        trace.push('drift_query');
    }
    if (events.length) {
        trace.push(`events:${events.length}`);
    }
    return {
        project_core_direction,
        primary_intent_statement: pik.primary_intent.statement,
        current_alignment_score,
        drift,
        goal_hierarchy: pik.goal_hierarchy,
        current_focus: currentFocus,
        recommended_next_focus,
        reasoning_trace: trace,
        sources: [...new Set(sources)],
    };
}
