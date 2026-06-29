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
exports.generateProjectIntentKernel = generateProjectIntentKernel;
exports.ensureProjectIntentKernel = ensureProjectIntentKernel;
const path = __importStar(require("node:path"));
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
const projectIdentity_js_1 = require("../../intelligence/projectIdentity.js");
const intentVNext_js_1 = require("../../intelligence/intentVNext.js");
const store_js_1 = require("../../understanding/store.js");
const eventStore_js_1 = require("../eventStore.js");
const store_js_2 = require("./store.js");
const types_js_1 = require("./types.js");
function clamp01(n) {
    return Math.max(0, Math.min(1, n));
}
function uniqGoals(candidates) {
    const map = new Map();
    for (const c of candidates) {
        const g = c.goal.trim();
        if (!g || g.length < 4) {
            continue;
        }
        map.set(g, Math.max(map.get(g) ?? 0, c.weight));
    }
    const sorted = [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([goal, weight]) => ({ goal, weight: clamp01(weight) }));
    const total = sorted.reduce((s, g) => s + g.weight, 0) || 1;
    return sorted.map((g) => ({ goal: g.goal, weight: clamp01(g.weight / total) }));
}
/** Derive PIK from PIL/CIL artifacts — goal structure, not event summary. */
async function generateProjectIntentKernel(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const [state, handoff, intents, adrs, identity] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(root),
        (0, store_js_1.readHandoffArtifact)(root),
        (0, intentVNext_js_1.readIntentNodesVNext)(root),
        (0, eventStore_js_1.readAllAdrRecords)(root),
        (0, projectIdentity_js_1.readProjectIdentity)(root),
    ]);
    const projectName = identity?.project_id ?? path.basename(root);
    const focus = handoff?.goal?.trim() || handoff?.current_focus?.trim() || state?.currentTask?.trim() || '';
    const primaryStatement = focus ||
        intents[0]?.description?.trim() ||
        intents[0]?.title?.trim() ||
        adrs[0]?.reason?.trim() ||
        'Build and evolve this codebase with traceable project memory';
    const goalCandidates = [];
    if (focus) {
        goalCandidates.push({ goal: focus, weight: 0.45 });
    }
    for (const node of intents.slice(0, 4)) {
        const text = node.description?.trim() || node.title?.trim();
        if (text) {
            goalCandidates.push({ goal: text, weight: 0.25 });
        }
    }
    for (const adr of adrs.slice(0, 3)) {
        if (adr.reason?.trim()) {
            goalCandidates.push({ goal: adr.reason.trim(), weight: 0.2 });
        }
    }
    for (const na of handoff?.next_actions?.slice(0, 3) ?? []) {
        const t = na.action?.trim() || na.target?.trim();
        if (t) {
            goalCandidates.push({ goal: t, weight: 0.15 });
        }
    }
    const goal_hierarchy = uniqGoals(goalCandidates);
    if (goal_hierarchy.length === 0) {
        goal_hierarchy.push({ goal: primaryStatement, weight: 1 });
    }
    const constraints = [
        ...new Set([
            ...types_js_1.DEFAULT_PIK.constraints,
            ...(intents[0]?.constraints ?? []),
        ]),
    ].slice(0, 8);
    const kernel = {
        schema: types_js_1.PIK_SCHEMA,
        updated_at: new Date().toISOString(),
        source: 'derived',
        project_identity: {
            name: projectName,
            type: identity?.project_id ? 'Project Cognitive Runtime' : 'Software Project',
        },
        primary_intent: {
            statement: primaryStatement,
            confidence: focus ? 0.85 : intents.length ? 0.7 : 0.55,
        },
        goal_hierarchy,
        non_goals: [...types_js_1.DEFAULT_PIK.non_goals],
        constraints,
        semantic_bias: {
            memory: handoff ? 0.35 : 0.3,
            reasoning: adrs.length ? 0.4 : 0.35,
            execution: state?.currentTask ? 0.25 : 0.2,
        },
    };
    return (0, store_js_2.writeProjectIntentKernel)(root, kernel);
}
/** Load PIK or derive once when missing / stale focus changed. */
async function ensureProjectIntentKernel(workspaceRoot) {
    const existing = await (0, store_js_2.readProjectIntentKernel)(workspaceRoot);
    const state = await (0, bootstrapState_js_1.readStateJson)(workspaceRoot);
    const handoff = await (0, store_js_1.readHandoffArtifact)(workspaceRoot);
    const liveFocus = handoff?.goal?.trim() || handoff?.current_focus?.trim() || state?.currentTask?.trim() || '';
    if (!existing) {
        return generateProjectIntentKernel(workspaceRoot);
    }
    if (liveFocus && existing.primary_intent.statement !== liveFocus && existing.source === 'derived') {
        return generateProjectIntentKernel(workspaceRoot);
    }
    return existing;
}
