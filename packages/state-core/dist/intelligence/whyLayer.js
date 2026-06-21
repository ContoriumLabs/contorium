"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readWhyLayer = readWhyLayer;
exports.syncWhyLayer = syncWhyLayer;
const fs = __importStar(require("node:fs/promises"));
const store_js_1 = require("../governance/store.js");
const store_js_2 = require("../understanding/store.js");
const decisionProvenance_js_1 = require("./decisionProvenance.js");
const intentVNext_js_1 = require("./intentVNext.js");
const paths_js_1 = require("./paths.js");
const types_js_1 = require("./types.js");
async function readWhyLayer(workspaceRoot) {
    try {
        const text = await fs.readFile((0, paths_js_1.whyLayerPath)(workspaceRoot), 'utf8');
        const raw = JSON.parse(text);
        if (raw?.schema === types_js_1.WHY_LAYER_SCHEMA && Array.isArray(raw.features)) {
            return raw;
        }
        return null;
    }
    catch {
        return null;
    }
}
function moduleFromPath(file) {
    const parts = file.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length >= 2) {
        return parts.slice(0, 2).join('/');
    }
    return parts[0] ?? 'project';
}
async function syncWhyLayer(workspaceRoot) {
    const [identity, handoff, intents, decisions] = await Promise.all([
        (0, store_js_1.readIdentity)(workspaceRoot),
        (0, store_js_2.readHandoffArtifact)(workspaceRoot),
        (0, intentVNext_js_1.readIntentNodesVNext)(workspaceRoot),
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot),
    ]);
    const features = [];
    const seen = new Set();
    const push = (entry) => {
        const key = entry.feature.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        features.push(entry);
    };
    if (identity?.purpose) {
        push({
            feature: identity.name ?? 'project',
            why: identity.purpose,
            problem: 'Project purpose must persist across AI sessions and tools',
            value: 'Structured inheritance instead of re-explaining architecture',
            origin_decision: decisions?.nodes?.[decisions.nodes.length - 1]?.decision_id ?? '',
            linked_intent: intents[0]?.intent_id ?? 'project',
        });
    }
    for (const intent of intents.slice(0, 24)) {
        push({
            feature: intent.name || intent.intent_id,
            why: intent.why || intent.description,
            problem: 'Intent is lost when switching AI tools or starting new chats',
            value: 'Cross-session project cognition',
            origin_decision: intent.linked_decisions[0] ?? '',
            linked_intent: intent.intent_id,
        });
    }
    if (handoff?.current_focus?.trim()) {
        push({
            feature: moduleFromPath(handoff.current_focus),
            why: handoff.current_focus,
            problem: 'Active work context is invisible to AI without handoff',
            value: 'Continuity for current task and focus',
            origin_decision: decisions?.nodes?.[decisions.nodes.length - 1]?.decision_id ?? '',
            linked_intent: intents.find((i) => i.name.includes(handoff.current_focus))?.intent_id ?? '',
        });
    }
    for (const dec of (decisions?.nodes ?? []).slice(-8)) {
        push({
            feature: dec.title,
            why: dec.reason,
            problem: dec.context,
            value: dec.selected,
            origin_decision: dec.decision_id,
            linked_intent: dec.linked_intent,
        });
    }
    const artifact = {
        schema: types_js_1.WHY_LAYER_SCHEMA,
        updated_at: new Date().toISOString(),
        features: features.slice(0, 64),
    };
    await fs.mkdir((0, paths_js_1.intentDir)(workspaceRoot), { recursive: true });
    await fs.writeFile((0, paths_js_1.whyLayerPath)(workspaceRoot), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    return artifact;
}
