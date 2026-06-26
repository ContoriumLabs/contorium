"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveNextActions = deriveNextActions;
exports.getNextActions = getNextActions;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const intentVNext_js_1 = require("../intelligence/intentVNext.js");
const store_js_1 = require("../understanding/store.js");
const impactGraph_js_1 = require("../intelligence/dimensions/impactGraph.js");
const confidenceLabels_js_1 = require("./confidenceLabels.js");
const cognitiveHealth_js_1 = require("./cognitiveHealth.js");
const knowledgeGraph_js_1 = require("./knowledgeGraph.js");
const eventStore_js_1 = require("./eventStore.js");
function confidenceScore(level) {
    if (level === 'high') {
        return 0.9;
    }
    if (level === 'medium') {
        return 0.65;
    }
    return 0.4;
}
function actionConstraints(risk) {
    return {
        risk,
        requires_confirmation: risk !== 'low',
        is_executable: false,
    };
}
/** Derive next actions — reads Event/Decision/State/Knowledge/Health, suggestions only. */
async function deriveNextActions(workspaceRoot) {
    const [state, handoff, intents, events, adrs, impact, health] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, store_js_1.readHandoffArtifact)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot),
        (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot),
        (0, impactGraph_js_1.readImpactGraph)(workspaceRoot),
        (0, cognitiveHealth_js_1.computeCognitiveHealth)(workspaceRoot).catch(() => null),
    ]);
    const actions = [];
    const seen = new Set();
    const push = (item) => {
        const key = item.task.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        actions.push(item);
    };
    const focus = state?.currentTask?.trim() || handoff?.current_focus?.trim();
    if (focus) {
        push({
            task: focus,
            reason: 'Current project focus',
            confidence: confidenceScore('high'),
            source: 'focus',
            constraints: actionConstraints('low'),
        });
    }
    for (const na of handoff?.next_actions?.slice(0, 4) ?? []) {
        push({
            task: `${na.action}: ${na.target}`,
            reason: na.reason,
            confidence: confidenceScore('high'),
            source: 'handoff',
            constraints: actionConstraints('low'),
        });
    }
    for (const node of intents?.nodes ?? []) {
        const incomplete = !focus || !node.name.toLowerCase().includes(focus.slice(0, 12).toLowerCase());
        if (incomplete && node.name) {
            push({
                task: `Advance intent: ${node.name}`,
                reason: node.why?.trim() || 'Intent not fully reflected in current focus',
                confidence: confidenceScore(focus ? 'medium' : 'high'),
                source: 'intent',
                constraints: actionConstraints('medium'),
            });
        }
    }
    for (const adr of adrs) {
        if (adr.status === 'proposed') {
            push({
                task: `Review decision: ${adr.title}`,
                reason: 'Decision pending acceptance',
                confidence: confidenceScore('medium'),
                source: 'decision',
                constraints: actionConstraints('medium'),
            });
        }
        if (adr.freshness === 'stale' || adr.freshness === 'unknown') {
            push({
                task: `Verify decision: ${adr.title}`,
                reason: `Status ${(0, confidenceLabels_js_1.freshnessLabelText)(adr.freshness)} — last verified ${adr.last_verified?.slice(0, 10) ?? 'unknown'}`,
                confidence: confidenceScore('medium'),
                source: 'decision',
                constraints: actionConstraints('medium'),
            });
        }
    }
    const latestImpact = impact?.entries[impact.entries.length - 1];
    if (latestImpact && (latestImpact.blast_radius ?? 0) >= 0.6) {
        push({
            task: `Review high-impact change: ${latestImpact.source_entity}`,
            reason: `Blast radius ${(latestImpact.blast_radius ?? latestImpact.impact_radius ?? 0).toFixed(2)}`,
            confidence: confidenceScore('high'),
            source: 'impact',
            constraints: actionConstraints('high'),
        });
    }
    const recentDecision = events.find((e) => e.decision && (0, confidenceLabels_js_1.freshnessFromAge)(e.timestamp) === 'fresh');
    if (recentDecision?.decision) {
        push({
            task: `Follow through: ${recentDecision.decision}`,
            reason: recentDecision.why || 'Recent decision recorded',
            confidence: confidenceScore('medium'),
            source: 'decision',
            constraints: actionConstraints('medium'),
        });
    }
    for (const w of health?.warnings.filter((x) => x.severity !== 'low').slice(0, 3) ?? []) {
        push({
            task: `Address cognition gap: ${w.message}`,
            reason: `Cognitive health ${health?.score ?? 0}% — ${w.code}`,
            confidence: confidenceScore(w.severity === 'high' ? 'high' : 'medium'),
            source: 'decision',
            constraints: actionConstraints(w.severity === 'high' ? 'high' : 'medium'),
        });
    }
    const focusEntity = focus?.split(/\s+/).find((w) => w.length >= 3);
    if (focusEntity) {
        const kg = await (0, knowledgeGraph_js_1.exploreEntityKnowledge)(workspaceRoot, focusEntity).catch(() => null);
        if (kg?.record && kg.record.events.length === 0 && kg.record.decisions.length === 0) {
            push({
                task: `Link focus "${focusEntity}" to decisions or events`,
                reason: 'Knowledge graph has no entity links for current focus',
                confidence: confidenceScore('low'),
                source: 'intent',
                constraints: actionConstraints('low'),
            });
        }
    }
    if (actions.length === 0) {
        push({
            task: 'Set current focus',
            reason: 'No focus or intent signal — run capture focus or IDE Current Focus',
            confidence: confidenceScore('low'),
            source: 'focus',
            constraints: actionConstraints('low'),
        });
    }
    return actions.slice(0, 8);
}
async function getNextActions(workspaceRoot) {
    const items = await deriveNextActions(workspaceRoot);
    return items.map((a) => `${a.task} — ${a.reason} (${a.confidence})`);
}
