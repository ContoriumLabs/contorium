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
exports.builderDir = builderDir;
exports.parseProjectBuiltState = parseProjectBuiltState;
exports.readProjectBuiltState = readProjectBuiltState;
exports.readProjectSnapshotMarkdown = readProjectSnapshotMarkdown;
exports.writeProjectBuiltState = writeProjectBuiltState;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const snapshot_js_1 = require("./snapshot.js");
const types_js_1 = require("./types.js");
const BUILDER_REL = ['.contora', 'state-builder'];
function builderDir(workspaceRoot) {
    return path.join(workspaceRoot, ...BUILDER_REL);
}
function parseProjectBuiltState(raw) {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const o = raw;
    if (o.version !== types_js_1.PROJECT_BUILT_STATE_VERSION) {
        return undefined;
    }
    const strList = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    return {
        version: types_js_1.PROJECT_BUILT_STATE_VERSION,
        generatedAt: typeof o.generatedAt === 'number' ? o.generatedAt : Date.now(),
        task_anchor: typeof o.task_anchor === 'string' ? o.task_anchor : undefined,
        engine_version: typeof o.engine_version === 'number' ? o.engine_version : undefined,
        project_goal: typeof o.project_goal === 'string' ? o.project_goal : '',
        current_stage: typeof o.current_stage === 'string' ? o.current_stage : '',
        active_modules: strList(o.active_modules),
        recent_decisions: strList(o.recent_decisions),
        open_problems: strList(o.open_problems),
        completed_milestones: strList(o.completed_milestones),
        next_actions: strList(o.next_actions),
        confidence: typeof o.confidence === 'number' ? o.confidence : 0,
    };
}
async function readProjectBuiltState(workspaceRoot) {
    try {
        const text = await fs.readFile(path.join(builderDir(workspaceRoot), 'project-state.json'), 'utf8');
        return parseProjectBuiltState(JSON.parse(text));
    }
    catch {
        return undefined;
    }
}
async function readProjectSnapshotMarkdown(workspaceRoot) {
    try {
        const text = (await fs.readFile(path.join(builderDir(workspaceRoot), 'project-snapshot.md'), 'utf8')).trim();
        return text.length ? text : undefined;
    }
    catch {
        return undefined;
    }
}
async function writeProjectBuiltState(workspaceRoot, built, snapshotMarkdown) {
    const dir = builderDir(workspaceRoot);
    await fs.mkdir(dir, { recursive: true });
    const md = snapshotMarkdown ?? (0, snapshot_js_1.formatProjectSnapshotMarkdown)(built);
    await Promise.all([
        fs.writeFile(path.join(dir, 'project-state.json'), JSON.stringify(built, null, 2), 'utf8'),
        fs.writeFile(path.join(dir, 'project-snapshot.md'), md, 'utf8'),
    ]);
}
