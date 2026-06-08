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
exports.syncWorkspaceState = syncWorkspaceState;
exports.readWorkspaceStatus = readWorkspaceStatus;
const path = __importStar(require("node:path"));
const node_fs_1 = require("node:fs");
const bootstrapState_js_1 = require("./bootstrap/bootstrapState.js");
const rebuildFromScan_js_1 = require("./state-builder/rebuildFromScan.js");
const buildUnderstanding_js_1 = require("./understanding/buildUnderstanding.js");
const dualMode_js_1 = require("./dualMode.js");
const dashboardActivity_js_1 = require("./dashboardActivity.js");
const workspaceScanner_js_1 = require("./scanner/workspaceScanner.js");
async function countEventLines(workspaceRoot) {
    const { readdir, readFile } = await Promise.resolve().then(() => __importStar(require('node:fs/promises')));
    const { join } = await Promise.resolve().then(() => __importStar(require('node:path')));
    const dir = join(workspaceRoot, '.contora', 'events');
    let total = 0;
    try {
        const files = await readdir(dir);
        for (const f of files) {
            if (!f.endsWith('.jsonl')) {
                continue;
            }
            const text = await readFile(join(dir, f), 'utf8');
            total += text.split('\n').filter((l) => l.trim()).length;
        }
    }
    catch {
        return 0;
    }
    return total;
}
/**
 * Shared one-shot sync for MCP / CLI adapters (runtime adapter pattern).
 * Scans workspace, merges into state.json, optionally rebuilds L4 when no events.
 */
async function syncWorkspaceState(workspaceRoot, writer, options) {
    const resolved = path.resolve(workspaceRoot);
    const existing = await (0, bootstrapState_js_1.readStateJson)(resolved);
    const refreshGit = options?.refreshGit === true;
    const skipGitScan = options?.skipGitScan ?? !refreshGit;
    const skipGitTimeline = skipGitScan || options?.gitStatusOnly === true;
    const cachedGit = skipGitScan
        ? {
            staged: existing?.gitStaged ?? [],
            working: existing?.gitWorking ?? [],
            isRepo: (0, node_fs_1.existsSync)(path.join(resolved, '.git')),
        }
        : undefined;
    const scan = await (0, workspaceScanner_js_1.scanWorkspace)(resolved, {
        skipGitScan,
        cachedGit,
    });
    const eventCount = await countEventLines(resolved);
    const created = !existing;
    if (!existing) {
        const state = (0, bootstrapState_js_1.bootstrapStateFromScan)(scan);
        await (0, bootstrapState_js_1.writeStateJson)(resolved, state, { mode: 'scan-driven', writer });
        await (0, rebuildFromScan_js_1.rebuildArtifactsFromScan)(resolved, scan, state, writer, {
            skipGitTimeline,
        });
        const written = await (0, bootstrapState_js_1.readStateJson)(resolved);
        return {
            mode: 'scan-driven',
            created: true,
            updated: true,
            source: written?.source,
            eventCount,
        };
    }
    const dual = (0, dualMode_js_1.buildDualModeInput)({ state: existing, eventCount, scan });
    const gitChanged = JSON.stringify(existing.gitStaged) !== JSON.stringify(dual.state.gitStaged) ||
        JSON.stringify(existing.gitWorking) !== JSON.stringify(dual.state.gitWorking);
    const recentChanged = JSON.stringify(existing.recentFiles) !== JSON.stringify(dual.state.recentFiles);
    const shouldWrite = gitChanged || recentChanged || options?.forceArtifacts;
    if (shouldWrite) {
        await (0, bootstrapState_js_1.writeStateJson)(resolved, dual.state, { mode: dual.mode, writer });
    }
    if (eventCount === 0 && (shouldWrite || options?.forceArtifacts)) {
        await (0, rebuildFromScan_js_1.rebuildArtifactsFromScan)(resolved, scan, dual.state, writer, {
            skipGitTimeline,
        });
    }
    if (gitChanged || recentChanged || (options?.forceArtifacts && created)) {
        if (!options?.gitStatusOnly) {
            await (0, buildUnderstanding_js_1.buildAndWriteUnderstandingArtifacts)({
                workspaceRoot: resolved,
                state: dual.state,
                scan,
                skipGitTimeline,
                allowGitDiff: refreshGit && !options?.gitStatusOnly,
            }).catch(() => undefined);
        }
    }
    const written = await (0, bootstrapState_js_1.readStateJson)(resolved);
    const updated = shouldWrite || (eventCount === 0 && !!options?.forceArtifacts);
    if (updated || gitChanged || recentChanged) {
        await (0, dashboardActivity_js_1.bumpWorkspaceActivity)(resolved, {
            source: writer,
            kind: gitChanged ? 'git_change' : recentChanged ? 'file_change' : 'sync',
            detail: gitChanged ? 'workspace sync' : recentChanged ? 'recent files updated' : undefined,
        }).catch(() => undefined);
    }
    return {
        mode: dual.mode,
        created: false,
        updated,
        source: written?.source,
        eventCount,
    };
}
/** Read-only status for CLI `status` / IDE-less inspection. */
async function readWorkspaceStatus(workspaceRoot) {
    const resolved = path.resolve(workspaceRoot);
    const state = await (0, bootstrapState_js_1.readStateJson)(resolved);
    const scan = await (0, workspaceScanner_js_1.scanWorkspace)(resolved, {
        skipGitScan: true,
        cachedGit: state
            ? {
                staged: state.gitStaged ?? [],
                working: state.gitWorking ?? [],
                isRepo: (0, node_fs_1.existsSync)(path.join(resolved, '.git')),
            }
            : {
                staged: [],
                working: [],
                isRepo: (0, node_fs_1.existsSync)(path.join(resolved, '.git')),
            },
    });
    const eventCount = await countEventLines(workspaceRoot);
    const mode = state
        ? (0, dualMode_js_1.buildDualModeInput)({ state, eventCount, scan }).mode
        : 'unknown';
    return {
        workspaceRoot: resolved,
        hasState: !!state,
        mode,
        source: state?.source,
        eventCount,
        gitWorking: state?.gitWorking.length ?? scan.gitWorking.length,
        gitStaged: state?.gitStaged.length ?? scan.gitStaged.length,
        currentTask: state?.currentTask ?? '',
    };
}
