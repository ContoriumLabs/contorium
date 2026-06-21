"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.structureDecisionNode = structureDecisionNode;
/** Normalize captured decision input into a provenance node (Structure layer). */
function structureDecisionNode(input) {
    const selected = input.selected.trim();
    const now = new Date().toISOString();
    return {
        decision_id: input.decision_id?.trim() || `dec_${Date.now().toString(36)}`,
        title: selected.slice(0, 120),
        context: 'PIL capture',
        alternatives: [],
        selected,
        reason: input.reason?.trim() || 'captured via PIL runtime',
        tradeoffs: [],
        impact_scope: [],
        linked_intent: input.intent_id?.trim() || 'project',
        reversibility: 'unknown',
        timestamp: now,
    };
}
