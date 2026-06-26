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
exports.COGNITIVE_HEALTH_FILE = exports.CIL_INDEX_FILE = exports.KNOWLEDGE_DIR = exports.MODULE_HISTORY_DIR = exports.SNAPSHOTS_DIR = exports.ADR_DIR = exports.COGNITIVE_EVENTS_DIR = void 0;
exports.cilRoot = cilRoot;
exports.cognitiveEventsDir = cognitiveEventsDir;
exports.cognitiveEventPath = cognitiveEventPath;
exports.adrDir = adrDir;
exports.adrPath = adrPath;
exports.snapshotsDir = snapshotsDir;
exports.snapshotPath = snapshotPath;
exports.moduleHistoryDir = moduleHistoryDir;
exports.moduleHistoryPath = moduleHistoryPath;
exports.cilIndexPath = cilIndexPath;
exports.decisionGraphPath = decisionGraphPath;
exports.knowledgeDir = knowledgeDir;
exports.knowledgeEntityPath = knowledgeEntityPath;
exports.knowledgeIndexPath = knowledgeIndexPath;
exports.cognitiveHealthPath = cognitiveHealthPath;
const path = __importStar(require("node:path"));
exports.COGNITIVE_EVENTS_DIR = 'cognitive-events';
exports.ADR_DIR = 'decisions';
exports.SNAPSHOTS_DIR = 'snapshots';
exports.MODULE_HISTORY_DIR = 'module-history';
exports.KNOWLEDGE_DIR = 'knowledge';
exports.CIL_INDEX_FILE = 'cil_index.json';
exports.COGNITIVE_HEALTH_FILE = 'cognitive-health.json';
function cilRoot(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), '.contora');
}
function cognitiveEventsDir(workspaceRoot) {
    return path.join(cilRoot(workspaceRoot), exports.COGNITIVE_EVENTS_DIR);
}
function cognitiveEventPath(workspaceRoot, eventId) {
    const date = eventId.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? 'unknown';
    return path.join(cognitiveEventsDir(workspaceRoot), `${date}_${eventId}.json`);
}
function adrDir(workspaceRoot) {
    return path.join(cilRoot(workspaceRoot), exports.ADR_DIR);
}
function adrPath(workspaceRoot, adrId) {
    return path.join(adrDir(workspaceRoot), `${adrId}.json`);
}
function snapshotsDir(workspaceRoot) {
    return path.join(cilRoot(workspaceRoot), exports.SNAPSHOTS_DIR);
}
function snapshotPath(workspaceRoot, snapshotId) {
    return path.join(snapshotsDir(workspaceRoot), `${snapshotId}.json`);
}
function moduleHistoryDir(workspaceRoot) {
    return path.join(cilRoot(workspaceRoot), exports.MODULE_HISTORY_DIR);
}
function moduleHistoryPath(workspaceRoot, moduleSlug) {
    return path.join(moduleHistoryDir(workspaceRoot), `${moduleSlug}.json`);
}
function cilIndexPath(workspaceRoot) {
    return path.join(cilRoot(workspaceRoot), exports.CIL_INDEX_FILE);
}
function decisionGraphPath(workspaceRoot) {
    return path.join(adrDir(workspaceRoot), 'graph.json');
}
function knowledgeDir(workspaceRoot) {
    return path.join(cilRoot(workspaceRoot), exports.KNOWLEDGE_DIR);
}
function knowledgeEntityPath(workspaceRoot, entitySlug) {
    return path.join(knowledgeDir(workspaceRoot), `${entitySlug}.json`);
}
function knowledgeIndexPath(workspaceRoot) {
    return path.join(knowledgeDir(workspaceRoot), '_index.json');
}
function cognitiveHealthPath(workspaceRoot) {
    return path.join(cilRoot(workspaceRoot), exports.COGNITIVE_HEALTH_FILE);
}
