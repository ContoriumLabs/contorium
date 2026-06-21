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
exports.migrateProjectIntelligenceLayout = migrateProjectIntelligenceLayout;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const paths_js_1 = require("../paths.js");
const io_js_1 = require("../dimensions/io.js");
async function copyIfMissing(source, target) {
    try {
        await fs.access(target);
        return false;
    }
    catch {
        /* migrate */
    }
    try {
        const raw = await fs.readFile(source, 'utf8');
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, raw, 'utf8');
        return true;
    }
    catch {
        return false;
    }
}
/** v1.1.3 — migrate flat .contora layout to repository structure (non-destructive). */
async function migrateProjectIntelligenceLayout(workspaceRoot) {
    const migrated = [];
    if (await copyIfMissing((0, paths_js_1.legacyStatePath)(workspaceRoot), (0, paths_js_1.stateCanonicalPath)(workspaceRoot))) {
        migrated.push('state/state.json');
    }
    if (await copyIfMissing((0, paths_js_1.legacyDecisionGraphPath)(workspaceRoot), (0, paths_js_1.decisionGraphPath)(workspaceRoot))) {
        migrated.push('decision/decision_graph.json');
    }
    const legacyConf = await (0, io_js_1.readJsonFile)((0, paths_js_1.legacyStabilityIndexPath)(workspaceRoot));
    if (legacyConf && !(await (0, io_js_1.readJsonFile)((0, paths_js_1.confidenceIndexPath)(workspaceRoot)))) {
        await fs.mkdir(path.join((0, paths_js_1.contoraRoot)(workspaceRoot), 'confidence'), { recursive: true });
        await fs.writeFile((0, paths_js_1.confidenceIndexPath)(workspaceRoot), `${JSON.stringify(legacyConf, null, 2)}\n`, 'utf8');
        migrated.push('confidence/confidence_index.json');
    }
    if (await copyIfMissing((0, paths_js_1.legacyKnowledgeGraphPath)(workspaceRoot), (0, paths_js_1.knowledgeGraphCanonicalPath)(workspaceRoot))) {
        migrated.push('graph/knowledge_graph.json');
    }
    return { migrated };
}
