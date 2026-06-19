"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRelevantGovernanceForFile = getRelevantGovernanceForFile;
exports.buildGovernanceInjectPreview = buildGovernanceInjectPreview;
exports.compileGovernanceInjectPrompt = compileGovernanceInjectPrompt;
const governanceEngine_js_1 = require("../governance/governanceEngine.js");
const governanceReview_js_1 = require("../governance/governanceReview.js");
const store_js_1 = require("../governance/store.js");
function normalizeRelPath(p) {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
}
function pathMatchesProtected(filePath, pattern) {
    const norm = normalizeRelPath(filePath);
    const p = normalizeRelPath(pattern);
    return norm === p || norm.startsWith(`${p}/`) || norm.startsWith(p);
}
function pathMatchesGlob(filePath, pattern) {
    const norm = normalizeRelPath(filePath);
    const pat = normalizeRelPath(pattern);
    if (pat.endsWith('/**')) {
        const prefix = pat.slice(0, -3);
        return norm === prefix || norm.startsWith(`${prefix}/`);
    }
    if (pat.startsWith('**/')) {
        const suffix = pat.slice(3);
        return norm.endsWith(suffix) || norm.includes(`/${suffix}`);
    }
    return norm === pat || norm.startsWith(`${pat}/`);
}
async function getRelevantGovernanceForFile(workspaceRoot, activeFile) {
    const summary = await (0, governanceEngine_js_1.getGovernanceSummary)(workspaceRoot);
    const c = summary.constitution;
    const t = summary.truth;
    const file = activeFile ? normalizeRelPath(activeFile) : undefined;
    let matchedProtectedPath;
    let matchedProtectedLevel;
    if (file && c) {
        const hit = (0, governanceEngine_js_1.matchProtectedPath)(file, c);
        if (hit) {
            matchedProtectedPath = hit.path;
            matchedProtectedLevel = hit.level;
        }
    }
    const isMockPath = Boolean(file && t?.mock_data.some((pattern) => pathMatchesGlob(file, pattern)));
    const principles = c?.principles ?? [];
    const aiRules = c?.ai_rules ?? [];
    const protectedPaths = c ? (0, governanceEngine_js_1.normalizeProtectedPathRules)(c.protected_paths).map((r) => r.path) : [];
    const forbiddenActions = c?.forbidden_actions ?? [];
    let relevantRuleCount = principles.length + aiRules.length + forbiddenActions.length;
    if (file) {
        relevantRuleCount = aiRules.length + forbiddenActions.length + (matchedProtectedPath ? 2 : 1);
        if (isMockPath) {
            relevantRuleCount += 1;
        }
    }
    return {
        active: summary.found,
        activeFile: file,
        isProtected: Boolean(matchedProtectedPath),
        matchedProtectedPath,
        matchedProtectedLevel,
        isMockPath,
        principles,
        aiRules,
        protectedPaths,
        forbiddenActions,
        relevantRuleCount,
    };
}
function buildGovernanceInjectPreview(relevant) {
    if (!relevant.active) {
        return 'Governance not initialized — run bootstrap first.';
    }
    if (!relevant.activeFile) {
        return 'Open a file to inject file-specific governance rules into AI context.';
    }
    if (relevant.isProtected) {
        return `Protected file${relevant.matchedProtectedLevel ? ` (${relevant.matchedProtectedLevel})` : ''} — ${relevant.relevantRuleCount} rules for ${relevant.activeFile}`;
    }
    return `${relevant.relevantRuleCount} rules apply to ${relevant.activeFile} — ready for AI injection`;
}
async function compileGovernanceInjectPrompt(input, mode) {
    const [overlay, relevant, bundle, review] = await Promise.all([
        (0, store_js_1.readUserRequestOverlay)(input.workspaceRoot),
        getRelevantGovernanceForFile(input.workspaceRoot, input.activeFile),
        (0, governanceEngine_js_1.loadGovernanceBundle)(input.workspaceRoot),
        (0, governanceReview_js_1.readGovernanceReview)(input.workspaceRoot),
    ]);
    const projectGoal = (input.projectGoal ?? overlay?.goal ?? '').trim() || '(not set)';
    const userTask = (input.userTask ?? '').trim() || '(not set)';
    const file = relevant.activeFile ?? '(none)';
    if (mode === 'diff') {
        const lines = [`File: ${file}`, '', 'Relevant governance:'];
        if (!relevant.active) {
            lines.push('- Governance layer not loaded');
        }
        else if (!relevant.activeFile) {
            lines.push('- Open a workspace file for file-scoped rules');
        }
        else {
            if (relevant.isProtected) {
                lines.push(`- Path is protected (${relevant.matchedProtectedPath}, ${relevant.matchedProtectedLevel ?? 'high'}) — review change severity before edits`);
            }
            else {
                lines.push('- Path is not in protected list');
            }
            if (relevant.isMockPath) {
                lines.push('- File matches mock-data pattern — production values must stay flagged');
            }
            for (const rule of relevant.aiRules.slice(0, 6)) {
                lines.push(`- ${rule}`);
            }
            for (const forbidden of relevant.forbiddenActions.slice(0, 4)) {
                lines.push(`- Forbidden: ${forbidden.replace(/_/g, ' ')}`);
            }
            if (bundle?.truth.hardcoded_values.length) {
                lines.push('- No hardcoded production secrets or URLs in committed code');
            }
        }
        lines.push('', 'Action:', relevant.isProtected ? 'modify with confirmation' : 'modify');
        if (review && (!review.file || review.file === file || review.review_scope === 'git_staged')) {
            lines.push('', (0, governanceReview_js_1.formatReviewForInject)(review));
        }
        if (userTask !== '(not set)') {
            lines.push('', 'Task:', userTask);
        }
        return lines.join('\n');
    }
    const lines = [
        'SYSTEM CONTEXT:',
        '',
        'Project goal:',
        projectGoal,
        '',
        'Active governance:',
    ];
    if (!relevant.active || !bundle) {
        lines.push('- Governance bundle not loaded');
    }
    else {
        for (const p of relevant.principles.slice(0, 5)) {
            lines.push(`- ${p}`);
        }
        for (const rule of relevant.aiRules.slice(0, 6)) {
            lines.push(`- ${rule}`);
        }
        for (const forbidden of relevant.forbiddenActions.slice(0, 4)) {
            lines.push(`- Do not: ${forbidden.replace(/_/g, ' ')}`);
        }
    }
    lines.push('', 'Protected paths:');
    if (relevant.protectedPaths.length) {
        for (const p of relevant.protectedPaths.slice(0, 8)) {
            lines.push(p);
        }
    }
    else {
        lines.push('(none configured)');
    }
    lines.push('', 'Current file:', file);
    if (relevant.isProtected) {
        lines.push(`(protected — matched ${relevant.matchedProtectedPath})`);
    }
    if (relevant.isMockPath) {
        lines.push('(mock-data path — keep test values clearly marked)');
    }
    if (review) {
        lines.push('', (0, governanceReview_js_1.formatReviewForInject)(review));
    }
    lines.push('', 'User task:', userTask);
    if (bundle?.identity.non_goals.length) {
        lines.push('', 'Project non-goals (do not propose features that violate these):');
        for (const ng of bundle.identity.non_goals.slice(0, 5)) {
            lines.push(`- ${ng}`);
        }
    }
    lines.push('', 'You are working under the Contorium governance layer. Follow constraints above before editing code.');
    return lines.join('\n');
}
