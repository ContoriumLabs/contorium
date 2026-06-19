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
exports.governanceExists = governanceExists;
exports.readConstitution = readConstitution;
exports.writeConstitution = writeConstitution;
exports.readTruthLayer = readTruthLayer;
exports.writeTruthLayer = writeTruthLayer;
exports.readIdentity = readIdentity;
exports.writeIdentity = writeIdentity;
exports.writeCognitiveState = writeCognitiveState;
exports.writeCognitiveIntent = writeCognitiveIntent;
exports.writeCognitiveRisk = writeCognitiveRisk;
exports.writeCognitiveGraph = writeCognitiveGraph;
exports.readCognitiveState = readCognitiveState;
exports.readCognitiveIntent = readCognitiveIntent;
exports.readCognitiveGraph = readCognitiveGraph;
exports.readUserRequestOverlay = readUserRequestOverlay;
exports.writeUserRequestOverlay = writeUserRequestOverlay;
exports.readGuardSession = readGuardSession;
exports.writeGuardSession = writeGuardSession;
exports.readChangeLog = readChangeLog;
exports.writeChangeLog = writeChangeLog;
exports.appendExecutionLog = appendExecutionLog;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const GOVERNANCE_DIR = '.contora/governance';
const COGNITIVE_DIR = '.contora/cognitive';
const RUNTIME_DIR = '.contora/runtime';
function governancePath(workspaceRoot, name) {
    return path.join(workspaceRoot, GOVERNANCE_DIR, name);
}
function cognitivePath(workspaceRoot, name) {
    return path.join(workspaceRoot, COGNITIVE_DIR, name);
}
function runtimePath(workspaceRoot, name) {
    return path.join(workspaceRoot, RUNTIME_DIR, name);
}
async function readJson(filePath) {
    try {
        const text = await fs.readFile(filePath, 'utf8');
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
async function writeJson(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
async function governanceExists(workspaceRoot) {
    try {
        await fs.access(governancePath(workspaceRoot, 'constitution.json'));
        return true;
    }
    catch {
        return false;
    }
}
async function readConstitution(workspaceRoot) {
    return readJson(governancePath(workspaceRoot, 'constitution.json'));
}
async function writeConstitution(workspaceRoot, data) {
    await writeJson(governancePath(workspaceRoot, 'constitution.json'), data);
}
async function readTruthLayer(workspaceRoot) {
    return readJson(governancePath(workspaceRoot, 'truth.json'));
}
async function writeTruthLayer(workspaceRoot, data) {
    await writeJson(governancePath(workspaceRoot, 'truth.json'), data);
}
async function readIdentity(workspaceRoot) {
    return readJson(governancePath(workspaceRoot, 'identity.json'));
}
async function writeIdentity(workspaceRoot, data) {
    await writeJson(governancePath(workspaceRoot, 'identity.json'), data);
}
async function writeCognitiveState(workspaceRoot, data) {
    await writeJson(cognitivePath(workspaceRoot, 'state.json'), data);
}
async function writeCognitiveIntent(workspaceRoot, data) {
    await writeJson(cognitivePath(workspaceRoot, 'intent.json'), data);
}
async function writeCognitiveRisk(workspaceRoot, data) {
    await writeJson(cognitivePath(workspaceRoot, 'risk.json'), data);
}
async function writeCognitiveGraph(workspaceRoot, data) {
    await writeJson(cognitivePath(workspaceRoot, 'graph.json'), data);
}
async function readCognitiveState(workspaceRoot) {
    return readJson(cognitivePath(workspaceRoot, 'state.json'));
}
async function readCognitiveIntent(workspaceRoot) {
    return readJson(cognitivePath(workspaceRoot, 'intent.json'));
}
async function readCognitiveGraph(workspaceRoot) {
    return readJson(cognitivePath(workspaceRoot, 'graph.json'));
}
/** User-owned request overlay (merged into derived cognitive — not a second truth). */
async function readUserRequestOverlay(workspaceRoot) {
    return readJson(cognitivePath(workspaceRoot, 'user-request.json'));
}
async function writeUserRequestOverlay(workspaceRoot, data) {
    await writeJson(cognitivePath(workspaceRoot, 'user-request.json'), data);
}
async function readGuardSession(workspaceRoot) {
    return readJson(runtimePath(workspaceRoot, 'guard-session.json'));
}
async function writeGuardSession(workspaceRoot, data) {
    await writeJson(runtimePath(workspaceRoot, 'guard-session.json'), data);
}
async function readChangeLog(workspaceRoot) {
    return readJson(runtimePath(workspaceRoot, 'change-log.json'));
}
async function writeChangeLog(workspaceRoot, data) {
    await writeJson(runtimePath(workspaceRoot, 'change-log.json'), data);
}
async function appendExecutionLog(workspaceRoot, entry) {
    const dir = path.join(workspaceRoot, RUNTIME_DIR, 'execution_logs');
    await fs.mkdir(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const filePath = path.join(dir, `${day}.jsonl`);
    await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
}
