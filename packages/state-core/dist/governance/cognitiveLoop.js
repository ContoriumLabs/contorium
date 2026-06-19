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
exports.updateCognitiveFromInput = updateCognitiveFromInput;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const cognitiveProjection_js_1 = require("./cognitiveProjection.js");
const store_js_1 = require("./store.js");
const CONSTRAINT_MARKERS = /\b(must|without|never|low latency|high stability|no breaking|backward compat)/gi;
const GOAL_VERBS = /\b(add|fix|refactor|implement|upgrade|migrate|optimize|build|create|update|remove)\b/i;
function extractGoal(input) {
    const trimmed = input.trim();
    const firstLine = trimmed.split('\n')[0]?.trim() ?? trimmed;
    return firstLine.length > 240 ? `${firstLine.slice(0, 237)}…` : firstLine;
}
function extractConstraints(input) {
    const found = new Set();
    for (const match of input.matchAll(CONSTRAINT_MARKERS)) {
        const idx = match.index ?? 0;
        const slice = input.slice(Math.max(0, idx - 20), idx + 60).replace(/\s+/g, ' ').trim();
        if (slice.length > 8) {
            found.add(slice.length > 80 ? `${slice.slice(0, 77)}…` : slice);
        }
    }
    return [...found].slice(0, 6);
}
function inferPhaseFromInput(input) {
    const lower = input.toLowerCase();
    if (/\b(fix|bug|error|broken)\b/.test(lower)) {
        return 'bugfix';
    }
    if (/\b(refactor|cleanup|restructure)\b/.test(lower)) {
        return 'refactoring';
    }
    if (/\b(doc|readme|document)\b/.test(lower)) {
        return 'documentation';
    }
    if (GOAL_VERBS.test(lower)) {
        return 'active_development';
    }
    return 'exploration';
}
function moduleNodesFromInput(input, workspaceRoot) {
    const nodes = new Set();
    const relPathRe = /(?:packages\/[\w-]+|src\/[\w-]+|docs\/[\w-]+)/g;
    for (const m of input.matchAll(relPathRe)) {
        nodes.add(m[0].split('/')[0] === 'packages'
            ? m[0].split('/').slice(0, 2).join('/')
            : (m[0].split('/')[0] ?? m[0]));
    }
    if (nodes.size === 0) {
        nodes.add(path.basename(workspaceRoot));
    }
    return [...nodes].slice(0, 12);
}
/**
 * Record user intent as overlay only, then rebuild derived cognitive/*.json.
 * V3.1 handoff remains raw execution context; cognitive/ is derived projection.
 */
async function updateCognitiveFromInput(workspaceRoot, userInput) {
    const trimmed = userInput.trim();
    if (!trimmed) {
        return { updated: false };
    }
    const now = Date.now();
    const overlay = {
        version: 1,
        generatedAt: now,
        goal: extractGoal(trimmed),
        constraints: extractConstraints(trimmed),
        phase_hint: inferPhaseFromInput(trimmed),
        module_hints: moduleNodesFromInput(trimmed, workspaceRoot),
    };
    await (0, store_js_1.writeUserRequestOverlay)(workspaceRoot, overlay);
    await appendCognitiveInputLog(workspaceRoot, { ts: now, input: trimmed.slice(0, 500), goal: overlay.goal }).catch(() => undefined);
    const bootstrapState = await (0, bootstrapState_js_1.readStateJson)(workspaceRoot);
    await (0, cognitiveProjection_js_1.syncCognitiveLayer)(workspaceRoot, bootstrapState);
    const { readCognitiveIntent, readCognitiveState, readCognitiveGraph } = await Promise.resolve().then(() => __importStar(require('./store.js')));
    return {
        updated: true,
        user_request: overlay,
        state: await readCognitiveState(workspaceRoot),
        intent: await readCognitiveIntent(workspaceRoot),
        graph: await readCognitiveGraph(workspaceRoot),
    };
}
async function appendCognitiveInputLog(workspaceRoot, entry) {
    const dir = path.join(workspaceRoot, '.contora', 'cognitive');
    await fs.mkdir(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    await fs.appendFile(path.join(dir, `inputs-${day}.jsonl`), `${JSON.stringify(entry)}\n`, 'utf8');
}
