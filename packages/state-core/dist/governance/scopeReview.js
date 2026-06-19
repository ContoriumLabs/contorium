"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_FILES_PER_SCOPE = exports.RISK_RANK = void 0;
exports.reviewScopedFiles = reviewScopedFiles;
exports.listGitStagedRelativePaths = listGitStagedRelativePaths;
exports.getGitStagedDiff = getGitStagedDiff;
exports.reviewGitStagedChanges = reviewGitStagedChanges;
exports.reviewOpenFilesChanges = reviewOpenFilesChanges;
exports.listGitCommitRelativePaths = listGitCommitRelativePaths;
exports.getGitCommitFileDiff = getGitCommitFileDiff;
exports.reviewGitCommitChanges = reviewGitCommitChanges;
exports.pickHigherRiskReview = pickHigherRiskReview;
exports.mergeReviewArtifacts = mergeReviewArtifacts;
const runGit_js_1 = require("../scanner/runGit.js");
const index_js_1 = require("../control-core/index.js");
const changeAnalyzer_js_1 = require("./changeAnalyzer.js");
const governanceReview_js_1 = require("./governanceReview.js");
const MAX_FILES_PER_SCOPE = 48;
exports.MAX_FILES_PER_SCOPE = MAX_FILES_PER_SCOPE;
const RISK_RANK = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
};
exports.RISK_RANK = RISK_RANK;
function normalizeRel(p) {
    return p.trim().replace(/\\/g, '/');
}
function pickWorst(a, b) {
    if (!a) {
        return b;
    }
    if (!b) {
        return a;
    }
    if (RISK_RANK[b.risk] > RISK_RANK[a.risk]) {
        return b;
    }
    if (RISK_RANK[b.risk] === RISK_RANK[a.risk] && b.display_score < a.display_score) {
        return b;
    }
    return a;
}
/** Review a list of files in a scope; returns highest-risk artifact. */
async function reviewScopedFiles(workspaceRoot, files, opts) {
    const unique = [...new Map(files.map((f) => [normalizeRel(f.relativePath), f])).values()];
    if (!unique.length) {
        return null;
    }
    const control = (0, index_js_1.createControlSurface)(workspaceRoot, 'ide');
    const scopeFiles = (opts.scopeFiles ?? unique.map((f) => normalizeRel(f.relativePath))).map(normalizeRel);
    let worst = null;
    const prefix = opts.descriptionPrefix ?? 'Scope review';
    for (const file of unique.slice(0, MAX_FILES_PER_SCOPE)) {
        const rel = normalizeRel(file.relativePath);
        const diff = file.diff_text ?? '';
        const change = (0, changeAnalyzer_js_1.analyzeChange)({ target_path: rel, diff_text: diff });
        const result = await control.checkAction({
            type: 'file_write',
            target_path: rel,
            description: `${prefix}: ${rel}`,
            diff_text: diff || undefined,
            lines_added: file.lines_added ?? change.lines_added,
            lines_removed: file.lines_removed ?? change.lines_removed,
        });
        if (result.loop !== 'check') {
            continue;
        }
        const artifact = (0, governanceReview_js_1.buildGovernanceReviewArtifact)(result, rel, {
            reviewSource: opts.reviewSource,
            reviewScope: opts.reviewScope,
            stagedFiles: opts.reviewScope === 'git_staged' ? scopeFiles : undefined,
        });
        worst = pickWorst(worst, artifact);
    }
    if (worst && scopeFiles.length > 1 && opts.reviewScope !== 'git_staged') {
        worst = {
            ...worst,
            reason_chain: [
                ...worst.reason_chain,
                `${opts.reviewScope.replace(/_/g, ' ')}: ${scopeFiles.length} file(s) reviewed`,
            ],
        };
    }
    return worst;
}
async function listGitStagedRelativePaths(workspaceRoot) {
    try {
        const stdout = await (0, runGit_js_1.runGit)(workspaceRoot, ['diff', '--name-only', '--cached'], { force: true });
        return stdout
            .split('\n')
            .map((l) => normalizeRel(l))
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
async function getGitStagedDiff(workspaceRoot, relPath) {
    try {
        return await (0, runGit_js_1.runGit)(workspaceRoot, ['diff', '--cached', '--', relPath], { force: true });
    }
    catch {
        return '';
    }
}
async function reviewGitStagedChanges(workspaceRoot) {
    const files = await listGitStagedRelativePaths(workspaceRoot);
    if (!files.length) {
        return null;
    }
    const inputs = [];
    for (const rel of files.slice(0, MAX_FILES_PER_SCOPE)) {
        inputs.push({ relativePath: rel, diff_text: await getGitStagedDiff(workspaceRoot, rel) });
    }
    return reviewScopedFiles(workspaceRoot, inputs, {
        reviewSource: 'git_staged',
        reviewScope: 'git_staged',
        scopeFiles: files,
        descriptionPrefix: 'Git staged review',
    });
}
async function reviewOpenFilesChanges(workspaceRoot, files) {
    return reviewScopedFiles(workspaceRoot, files, {
        reviewSource: 'editor_diff',
        reviewScope: 'open_files',
        scopeFiles: files.map((f) => normalizeRel(f.relativePath)),
        descriptionPrefix: 'Open files review',
    });
}
async function listGitCommitRelativePaths(workspaceRoot) {
    try {
        await (0, runGit_js_1.runGit)(workspaceRoot, ['rev-parse', '--verify', 'HEAD'], { force: true });
        const stdout = await (0, runGit_js_1.runGit)(workspaceRoot, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { force: true });
        return stdout
            .split('\n')
            .map((l) => normalizeRel(l))
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
async function getGitCommitFileDiff(workspaceRoot, relPath) {
    try {
        return await (0, runGit_js_1.runGit)(workspaceRoot, ['show', 'HEAD', '--', relPath], { force: true });
    }
    catch {
        return '';
    }
}
async function reviewGitCommitChanges(workspaceRoot) {
    const files = await listGitCommitRelativePaths(workspaceRoot);
    if (!files.length) {
        return null;
    }
    const inputs = [];
    for (const rel of files.slice(0, MAX_FILES_PER_SCOPE)) {
        inputs.push({ relativePath: rel, diff_text: await getGitCommitFileDiff(workspaceRoot, rel) });
    }
    return reviewScopedFiles(workspaceRoot, inputs, {
        reviewSource: 'git_commit',
        reviewScope: 'git_commit',
        scopeFiles: files,
        descriptionPrefix: 'Git commit review',
    });
}
function pickHigherRiskReview(a, b) {
    return pickWorst(a, b) ?? a;
}
function mergeReviewArtifacts(artifacts) {
    let final = null;
    const scopeNotes = [];
    for (const artifact of artifacts) {
        if (!artifact) {
            continue;
        }
        if (!final) {
            final = artifact;
            continue;
        }
        const before = final;
        final = pickHigherRiskReview(final, artifact);
        if (final === artifact && final !== before) {
            scopeNotes.push(`${before.review_scope}: ${before.risk.toUpperCase()}`);
        }
        else if (final === before && artifact !== before) {
            scopeNotes.push(`${artifact.review_scope}: ${artifact.risk.toUpperCase()}`);
        }
        if (artifact.staged_files?.length) {
            final = { ...final, staged_files: artifact.staged_files };
        }
    }
    if (final && scopeNotes.length) {
        final = {
            ...final,
            reason_chain: [...final.reason_chain, ...scopeNotes.map((n) => `Also reviewed — ${n}`)],
        };
    }
    return final;
}
