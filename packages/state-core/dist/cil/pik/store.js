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
exports.PIK_KERNEL_FILE = void 0;
exports.pikKernelPath = pikKernelPath;
exports.readProjectIntentKernel = readProjectIntentKernel;
exports.writeProjectIntentKernel = writeProjectIntentKernel;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const paths_js_1 = require("../../intelligence/paths.js");
const types_js_1 = require("./types.js");
exports.PIK_KERNEL_FILE = 'kernel.json';
function pikKernelPath(workspaceRoot) {
    return path.join((0, paths_js_1.intentDir)(workspaceRoot), exports.PIK_KERNEL_FILE);
}
function normalizePik(raw) {
    return {
        ...types_js_1.DEFAULT_PIK,
        ...raw,
        schema: types_js_1.PIK_SCHEMA,
        project_identity: { ...types_js_1.DEFAULT_PIK.project_identity, ...raw.project_identity },
        primary_intent: { ...types_js_1.DEFAULT_PIK.primary_intent, ...raw.primary_intent },
        goal_hierarchy: Array.isArray(raw.goal_hierarchy) ? raw.goal_hierarchy : [],
        non_goals: Array.isArray(raw.non_goals) ? raw.non_goals : types_js_1.DEFAULT_PIK.non_goals,
        constraints: Array.isArray(raw.constraints) ? raw.constraints : types_js_1.DEFAULT_PIK.constraints,
        semantic_bias: { ...types_js_1.DEFAULT_PIK.semantic_bias, ...raw.semantic_bias },
        updated_at: raw.updated_at ?? new Date().toISOString(),
        source: raw.source ?? 'derived',
    };
}
async function readProjectIntentKernel(workspaceRoot) {
    try {
        const text = await fs.readFile(pikKernelPath(workspaceRoot), 'utf8');
        const raw = JSON.parse(text);
        if (raw?.schema !== types_js_1.PIK_SCHEMA) {
            return null;
        }
        return normalizePik(raw);
    }
    catch {
        return null;
    }
}
async function writeProjectIntentKernel(workspaceRoot, kernel) {
    const next = normalizePik({ ...kernel, updated_at: new Date().toISOString() });
    const file = pikKernelPath(workspaceRoot);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
}
