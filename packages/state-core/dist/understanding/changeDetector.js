"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectChangedFiles = collectChangedFiles;
exports.gitDiffChangedFiles = gitDiffChangedFiles;
exports.resolveChangedFiles = resolveChangedFiles;
const runGit_js_1 = require("../scanner/runGit.js");
const extractor_js_1 = require("./extractor.js");
function norm(p) {
    return p.replace(/\\/g, '/');
}
function uniqueTrackableFiles(paths) {
    const out = [];
    const seen = new Set();
    for (const p of paths) {
        const n = norm(p);
        if (!n || seen.has(n) || !(0, extractor_js_1.isTrackableFile)(n)) {
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
    return uniqueTrackableFiles(merged).slice(0, max);
}
/** Git diff names (staged + unstaged vs HEAD) — best-effort. */
async function gitDiffChangedFiles(workspaceRoot, max = 32) {
    try {
        const unstaged = await (0, runGit_js_1.runGit)(workspaceRoot, ['diff', '--name-only', 'HEAD'], {
            timeout: 12_000,
        });
        const staged = await (0, runGit_js_1.runGit)(workspaceRoot, ['diff', '--name-only', '--cached', 'HEAD'], {
            timeout: 12_000,
        });
        const all = [...unstaged.split('\n'), ...staged.split('\n')].map((l) => l.trim()).filter(Boolean);
        return uniqueTrackableFiles(all).slice(0, max);
    }
    catch {
        return [];
    }
}
async function resolveChangedFiles(workspaceRoot, state, scan, extraPaths = [], opts) {
    const fromGit = scan || !opts?.allowGitDiff ? [] : await gitDiffChangedFiles(workspaceRoot);
    const fromState = collectChangedFiles(state, extraPaths);
    const fromScan = scan
        ? uniqueTrackableFiles([...scan.gitStaged, ...scan.gitWorking, ...scan.recentFiles.slice(0, 12)])
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
