"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectChangedFiles = collectChangedFiles;
exports.gitDiffChangedFiles = gitDiffChangedFiles;
exports.resolveChangedFiles = resolveChangedFiles;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const extractor_js_1 = require("./extractor.js");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
function norm(p) {
    return p.replace(/\\/g, '/');
}
function uniqueCodeFiles(paths) {
    const out = [];
    const seen = new Set();
    for (const p of paths) {
        const n = norm(p);
        if (!n || seen.has(n) || !(0, extractor_js_1.isCodeFile)(n)) {
            continue;
        }
        seen.add(n);
        out.push(n);
    }
    return out;
}
/** Collect candidate changed files from state + optional scan facts. */
function collectChangedFiles(state, extraPaths = [], max = 32) {
    const merged = [
        ...state.gitStaged,
        ...state.gitWorking,
        ...state.recentFiles.slice(0, 16),
        ...extraPaths,
    ];
    return uniqueCodeFiles(merged).slice(0, max);
}
/** Git diff names (staged + unstaged vs HEAD) — best-effort. */
async function gitDiffChangedFiles(workspaceRoot, max = 32) {
    try {
        const { stdout: unstaged } = await execFileAsync('git', ['-C', workspaceRoot, 'diff', '--name-only', 'HEAD'], { timeout: 12_000, maxBuffer: 2 * 1024 * 1024 });
        const { stdout: staged } = await execFileAsync('git', ['-C', workspaceRoot, 'diff', '--name-only', '--cached', 'HEAD'], { timeout: 12_000, maxBuffer: 2 * 1024 * 1024 });
        const all = [...unstaged.split('\n'), ...staged.split('\n')].map((l) => l.trim()).filter(Boolean);
        return uniqueCodeFiles(all).slice(0, max);
    }
    catch {
        return [];
    }
}
async function resolveChangedFiles(workspaceRoot, state, scan, extraPaths = []) {
    const fromGit = await gitDiffChangedFiles(workspaceRoot);
    const fromState = collectChangedFiles(state, extraPaths);
    const fromScan = scan
        ? uniqueCodeFiles([...scan.gitStaged, ...scan.gitWorking, ...scan.recentFiles.slice(0, 12)])
        : [];
    const merged = [...fromGit, ...fromState, ...fromScan];
    const seen = new Set();
    const out = [];
    for (const f of merged) {
        if (seen.has(f)) {
            continue;
        }
        seen.add(f);
        out.push(f);
        if (out.length >= 32) {
            break;
        }
    }
    return out;
}
