"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveKnowledgeCoverage = deriveKnowledgeCoverage;
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
const decisionProvenance_js_1 = require("../decisionProvenance.js");
const intentVNext_js_1 = require("../intentVNext.js");
const whyLayer_js_1 = require("../whyLayer.js");
function moduleOf(pathLike) {
    return pathLike.replace(/\\/g, '/').split('/').filter(Boolean)[0] ?? pathLike;
}
function clamp01(n) {
    return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}
/**
 * Knowledge coverage — covered_modules / total_modules.
 * A module is covered when it has STATE presence and at least one of INTENT | DECISION | WHY.
 */
async function deriveKnowledgeCoverage(workspaceRoot) {
    const [state, intent, decisionGraph, why] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot),
        (0, whyLayer_js_1.readWhyLayer)(workspaceRoot),
    ]);
    const modules = new Set();
    for (const f of [...(state?.recentFiles ?? []), ...(state?.openFiles ?? [])]) {
        if (f.trim()) {
            modules.add(moduleOf(f));
        }
    }
    for (const node of intent?.nodes ?? []) {
        for (const m of node.related_modules) {
            if (m.trim()) {
                modules.add(moduleOf(m));
            }
        }
    }
    for (const node of decisionGraph?.nodes ?? []) {
        for (const p of node.impact_scope) {
            if (p.trim()) {
                modules.add(moduleOf(p));
            }
        }
    }
    for (const f of why?.features ?? []) {
        if (f.feature.trim()) {
            modules.add(moduleOf(f.feature));
        }
    }
    const stateModules = new Set();
    for (const f of [...(state?.recentFiles ?? []), ...(state?.openFiles ?? [])]) {
        stateModules.add(moduleOf(f));
    }
    const intentModules = new Set((intent?.nodes ?? []).flatMap((n) => n.related_modules.map(moduleOf)));
    const decisionModules = new Set((decisionGraph?.nodes ?? []).flatMap((n) => n.impact_scope.map(moduleOf)));
    const whyModules = new Set((why?.features ?? []).map((f) => moduleOf(f.feature)));
    const total_modules = [...modules].filter(Boolean);
    const covered_modules = total_modules.filter((mod) => {
        const hasState = stateModules.has(mod) || state?.sessionId;
        const hasCognition = intentModules.has(mod) || decisionModules.has(mod) || whyModules.has(mod);
        return Boolean(hasState && hasCognition);
    });
    const knowledge_coverage = total_modules.length > 0 ? clamp01(covered_modules.length / total_modules.length) : 0;
    return { knowledge_coverage, covered_modules, total_modules };
}
