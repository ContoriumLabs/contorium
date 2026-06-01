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
exports.bootstrapStateFromScan = bootstrapStateFromScan;
exports.readStateJson = readStateJson;
exports.writeStateJson = writeStateJson;
exports.stateJsonExists = stateJsonExists;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const sourceMetadata_js_1 = require("../sourceMetadata.js");
const CONTORA_DIR = '.contora';
function newSessionId() {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function bootstrapStateFromScan(scan) {
    return {
        sessionId: newSessionId(),
        currentTask: '',
        openFiles: scan.recentFiles.slice(0, 8),
        recentFiles: scan.recentFiles.slice(0, 24),
        gitStaged: scan.gitStaged,
        gitWorking: scan.gitWorking,
        notes: '',
        lastUpdated: scan.scannedAt,
    };
}
async function readStateJson(workspaceRoot) {
    const fp = path.join(workspaceRoot, CONTORA_DIR, 'state.json');
    try {
        const text = await fs.readFile(fp, 'utf8');
        const o = JSON.parse(text);
        const sourceRaw = o.source;
        let source;
        if (sourceRaw && typeof sourceRaw === 'object') {
            const s = sourceRaw;
            if ((s.mode === 'event-driven' || s.mode === 'scan-driven' || s.mode === 'merged') &&
                (s.lastWriter === 'ide' || s.lastWriter === 'mcp' || s.lastWriter === 'cli') &&
                typeof s.lastUpdated === 'string') {
                source = {
                    mode: s.mode,
                    lastWriter: s.lastWriter,
                    lastUpdated: s.lastUpdated,
                };
            }
        }
        return {
            sessionId: typeof o.sessionId === 'string' ? o.sessionId : newSessionId(),
            currentTask: typeof o.currentTask === 'string' ? o.currentTask : '',
            openFiles: Array.isArray(o.openFiles)
                ? o.openFiles.filter((x) => typeof x === 'string')
                : [],
            recentFiles: Array.isArray(o.recentFiles)
                ? o.recentFiles.filter((x) => typeof x === 'string')
                : [],
            gitStaged: Array.isArray(o.gitStaged)
                ? o.gitStaged.filter((x) => typeof x === 'string')
                : [],
            gitWorking: Array.isArray(o.gitWorking)
                ? o.gitWorking.filter((x) => typeof x === 'string')
                : [],
            notes: typeof o.notes === 'string' ? o.notes : '',
            lastUpdated: typeof o.lastUpdated === 'number' ? o.lastUpdated : 0,
            source,
        };
    }
    catch {
        return null;
    }
}
async function writeStateJson(workspaceRoot, state, meta) {
    const dir = path.join(workspaceRoot, CONTORA_DIR);
    await fs.mkdir(dir, { recursive: true });
    const toWrite = meta ? (0, sourceMetadata_js_1.attachStateSource)(state, meta.mode, meta.writer) : state;
    await fs.writeFile(path.join(dir, 'state.json'), JSON.stringify(toWrite, null, 2), 'utf8');
}
async function stateJsonExists(workspaceRoot) {
    try {
        await fs.access(path.join(workspaceRoot, CONTORA_DIR, 'state.json'));
        return true;
    }
    catch {
        return false;
    }
}
