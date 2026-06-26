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
exports.linkEventVersions = linkEventVersions;
exports.writeProjectSnapshot = writeProjectSnapshot;
exports.readProjectSnapshot = readProjectSnapshot;
exports.findSnapshotByDate = findSnapshotByDate;
exports.listProjectSnapshots = listProjectSnapshots;
const fs = __importStar(require("node:fs/promises"));
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const projectIdentity_js_1 = require("../intelligence/projectIdentity.js");
const paths_js_1 = require("./paths.js");
const types_js_1 = require("./types.js");
const io_js_1 = require("../intelligence/dimensions/io.js");
async function listSnapshotIds(workspaceRoot) {
    try {
        const files = await fs.readdir((0, paths_js_1.snapshotsDir)(workspaceRoot));
        return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
    }
    catch {
        return [];
    }
}
function linkEventVersions(events) {
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return sorted.map((evt, i) => ({
        ...evt,
        version: `snapshot_v${i + 1}`,
        previous: i > 0 ? sorted[i - 1].id : undefined,
        next: i < sorted.length - 1 ? sorted[i + 1].id : undefined,
    }));
}
async function writeProjectSnapshot(workspaceRoot, events, decisions = []) {
    const existing = await listSnapshotIds(workspaceRoot);
    const versionNum = existing.length + 1;
    const id = `snapshot_v${versionNum}`;
    const [state, identity] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, projectIdentity_js_1.readProjectIdentity)(workspaceRoot),
    ]);
    const snapshot = {
        schema: types_js_1.PROJECT_SNAPSHOT_SCHEMA,
        id,
        version: id,
        timestamp: new Date().toISOString(),
        state: {
            focus: state?.currentTask?.trim() || undefined,
            state_hash: identity?.current_state_hash,
            current_task: state?.currentTask?.trim() || undefined,
        },
        events: events.slice(-32),
        decisions: decisions.slice(-16),
        summary: state?.currentTask?.trim() ||
            events[events.length - 1]?.title ||
            'Project intelligence snapshot',
        projection_of: 'cognitive_events',
        derived_from: events.slice(-32).map((e) => e.id),
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.snapshotPath)(workspaceRoot, id), snapshot);
    return snapshot;
}
async function readProjectSnapshot(workspaceRoot, snapshotId) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.snapshotPath)(workspaceRoot, snapshotId));
    if (raw?.schema === types_js_1.PROJECT_SNAPSHOT_SCHEMA) {
        return raw;
    }
    const legacy = await (0, io_js_1.readJsonFile)((0, paths_js_1.snapshotPath)(workspaceRoot, snapshotId));
    if (legacy && legacy.schema === 'project_snapshot.v1') {
        return {
            schema: types_js_1.PROJECT_SNAPSHOT_SCHEMA,
            id: String(legacy.id),
            version: String(legacy.version),
            timestamp: String(legacy.timestamp),
            state: {
                focus: legacy.focus,
                state_hash: legacy.state_hash,
            },
            events: [],
            decisions: [],
            summary: String(legacy.summary ?? ''),
            projection_of: 'cognitive_events',
            derived_from: [],
        };
    }
    return null;
}
async function findSnapshotByDate(workspaceRoot, dateStr) {
    let best = null;
    let bestDelta = Infinity;
    const target = Date.parse(dateStr);
    if (!Number.isFinite(target)) {
        return null;
    }
    for (const id of await listSnapshotIds(workspaceRoot)) {
        const snap = await readProjectSnapshot(workspaceRoot, id);
        if (!snap) {
            continue;
        }
        const delta = Math.abs(Date.parse(snap.timestamp.slice(0, 10)) - target);
        if (delta < bestDelta) {
            bestDelta = delta;
            best = snap;
        }
    }
    return best;
}
async function listProjectSnapshots(workspaceRoot) {
    const ids = await listSnapshotIds(workspaceRoot);
    const snaps = [];
    for (const id of ids) {
        const s = await readProjectSnapshot(workspaceRoot, id);
        if (s) {
            snaps.push(s);
        }
    }
    return snaps.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
