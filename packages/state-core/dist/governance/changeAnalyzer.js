"use strict";
/** V3.2 — infer change type / severity from diff or snippet (not path alone). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeChangeConfidence = computeChangeConfidence;
exports.analyzeChange = analyzeChange;
const DB_PATTERNS = [
    /\bdrop\s+table\b/i,
    /\bdrop\s+database\b/i,
    /\btruncate\s+table\b/i,
    /\bdelete\s+from\s+\w+\s*;?\s*$/im,
    /\balter\s+table\b/i,
];
const SECURITY_PATTERNS = [
    /\brm\s+-rf\b/i,
    /\bformat\s+c:/i,
    /\b(api[_-]?key|secret|password|private[_-]?key)\s*=\s*['"][^'"]{8,}['"]/i,
    /\bbearer\s+[a-z0-9._-]{20,}/i,
    /\beval\s*\(/i,
    /\bchild_process\.exec\s*\(/i,
];
const ARCH_PATTERNS = [
    /\bexport\s+(interface|type|enum)\s+\w+/,
    /\babstract\s+class\b/,
    /^\+\s*export\s+(interface|type|enum)/m,
    /^\-\s*export\s+(interface|type|enum)/m,
];
const API_PATTERNS = [
    /\bexport\s+(async\s+)?function\s+\w+/,
    /\bexport\s+const\s+\w+\s*=/,
    /\b(app|router)\.(get|post|put|patch|delete)\(/i,
    /@(Get|Post|Put|Patch|Delete|Route)\(/,
    /\bpublic\s+(async\s+)?\w+\s*\(/,
];
const TEST_PATH_PATTERNS = [
    /(^|\/)tests?\//i,
    /(^|\/)__tests__\//i,
    /\.(test|spec)\.(tsx?|jsx?|mjs|cjs)$/i,
    /(^|\/)test_.*\.(tsx?|py)$/i,
];
const CONFIG_PATH_PATTERNS = [
    /\.json$/,
    /\.yaml$/,
    /\.yml$/,
    /package\.json$/,
    /tsconfig/,
    /\.env/,
];
const DOC_PATH_PATTERNS = [/readme/i, /\.md$/i, /docs\//i];
const STYLE_LINE = /^[\s;{},]*$/;
function countDiffLines(diff) {
    let added = 0;
    let removed = 0;
    for (const line of diff.split('\n')) {
        if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
            continue;
        }
        if (line.startsWith('+')) {
            added++;
        }
        else if (line.startsWith('-')) {
            removed++;
        }
    }
    return { added, removed };
}
function diffChangedLines(diff) {
    return diff
        .split('\n')
        .filter((l) => l.startsWith('+') || l.startsWith('-'))
        .map((l) => l.slice(1));
}
function diffBody(diff) {
    return diffChangedLines(diff).join('\n');
}
function isCommentLine(line) {
    const t = line.trim();
    return (!t ||
        t.startsWith('//') ||
        t.startsWith('*') ||
        t.startsWith('/*') ||
        t.startsWith('#') ||
        t.startsWith('<!--'));
}
function isCommentOnlyDiff(diff) {
    const lines = diffChangedLines(diff).map((l) => l.trim());
    if (lines.length === 0) {
        return false;
    }
    return lines.every(isCommentLine);
}
function isStyleOnlyDiff(diff) {
    const lines = diffChangedLines(diff);
    if (lines.length === 0) {
        return false;
    }
    return lines.every((l) => STYLE_LINE.test(l) || isCommentLine(l));
}
function matchesAny(text, patterns) {
    return patterns.some((re) => re.test(text));
}
function pathMatches(path, patterns) {
    if (!path) {
        return false;
    }
    const norm = path.replace(/\\/g, '/');
    return patterns.some((re) => re.test(norm));
}
function classifyProbe(probe, path) {
    const hints = [];
    if (matchesAny(probe, SECURITY_PATTERNS)) {
        hints.push('security');
    }
    if (matchesAny(probe, DB_PATTERNS)) {
        hints.push('database');
    }
    if (matchesAny(probe, ARCH_PATTERNS)) {
        hints.push('architecture');
    }
    if (matchesAny(probe, API_PATTERNS)) {
        hints.push('api');
    }
    if (pathMatches(path, TEST_PATH_PATTERNS)) {
        hints.push('test');
    }
    if (pathMatches(path, CONFIG_PATH_PATTERNS)) {
        hints.push('config');
    }
    if (pathMatches(path, DOC_PATH_PATTERNS)) {
        hints.push('comment');
    }
    if (hints.length === 0 && probe.trim()) {
        hints.push('logic');
    }
    return hints;
}
function pickPrimaryType(hints, diff, path) {
    const priority = [
        'security',
        'database',
        'architecture',
        'api',
        'test',
        'config',
        'logic',
        'comment',
        'style',
        'unknown',
    ];
    for (const p of priority) {
        if (hints.includes(p)) {
            return p;
        }
    }
    if (diff && isCommentOnlyDiff(diff)) {
        return 'comment';
    }
    if (diff && isStyleOnlyDiff(diff)) {
        return 'style';
    }
    if (pathMatches(path, TEST_PATH_PATTERNS)) {
        return 'test';
    }
    if (pathMatches(path, DOC_PATH_PATTERNS)) {
        return 'comment';
    }
    if (pathMatches(path, CONFIG_PATH_PATTERNS)) {
        return 'config';
    }
    return 'unknown';
}
function severityForType(changeType, linesAdded, linesRemoved) {
    const churn = linesAdded + linesRemoved;
    switch (changeType) {
        case 'comment':
        case 'style':
        case 'test':
            return 'low';
        case 'config':
            return churn > 40 ? 'medium' : 'low';
        case 'api':
            return churn > 50 ? 'high' : 'medium';
        case 'logic':
            return churn > 80 ? 'high' : 'medium';
        case 'architecture':
            return churn > 30 ? 'critical' : 'high';
        case 'database':
        case 'security':
            return 'critical';
        default:
            return churn > 50 ? 'medium' : 'low';
    }
}
/** Derive analysis confidence from change signals (never a fixed constant). */
function computeChangeConfidence(change) {
    const hasDiff = change.lines_added + change.lines_removed > 0;
    if (!hasDiff) {
        return 0.55;
    }
    if (change.mixed) {
        return clampConfidence(0.62 - Math.min(0.08, change.type_hints.length * 0.02));
    }
    const base = {
        comment: 0.95,
        style: 0.93,
        test: 0.88,
        config: 0.82,
        logic: 0.78,
        api: 0.85,
        architecture: 0.85,
        database: 0.92,
        security: 0.92,
        unknown: 0.65,
    };
    let c = base[change.change_type] ?? 0.65;
    const churn = change.lines_added + change.lines_removed;
    if (churn > 120) {
        c -= 0.06;
    }
    else if (churn < 4) {
        c += 0.03;
    }
    return clampConfidence(c);
}
function clampConfidence(n) {
    return Math.max(0.45, Math.min(0.98, Math.round(n * 100) / 100));
}
function analyzeChange(input) {
    const signals = [];
    const diff = input.diff_text?.trim() ?? '';
    const snippet = input.code_snippet?.trim() ?? '';
    const probe = diff ? diffBody(diff) : snippet;
    const path = input.target_path?.replace(/\\/g, '/');
    let lines_added = input.lines_added ?? 0;
    let lines_removed = input.lines_removed ?? 0;
    if (diff) {
        const counts = countDiffLines(diff);
        lines_added = counts.added;
        lines_removed = counts.removed;
    }
    if (diff && isCommentOnlyDiff(diff)) {
        signals.push('Comment-only diff');
        const analysis = {
            change_type: 'comment',
            severity: 'low',
            lines_added,
            lines_removed,
            mixed: false,
            type_hints: ['comment'],
            signals,
        };
        return analysis;
    }
    if (diff && isStyleOnlyDiff(diff)) {
        signals.push('Style-only diff (whitespace/formatting)');
        return {
            change_type: 'style',
            severity: 'low',
            lines_added,
            lines_removed,
            mixed: false,
            type_hints: ['style'],
            signals,
        };
    }
    const type_hints = classifyProbe(probe, path);
    if (pathMatches(path, TEST_PATH_PATTERNS) && !type_hints.includes('test')) {
        type_hints.push('test');
        signals.push('Test file path');
    }
    const uniqueHints = [...new Set(type_hints)];
    const mixed = uniqueHints.filter((t) => !['comment', 'style'].includes(t)).length > 1 ||
        (uniqueHints.includes('logic') && uniqueHints.some((t) => t === 'api' || t === 'architecture'));
    if (mixed) {
        signals.push(`Mixed change types: ${uniqueHints.join(', ')}`);
    }
    const change_type = pickPrimaryType(uniqueHints, diff, path);
    if (change_type === 'security') {
        signals.push('Security-sensitive pattern in change');
    }
    else if (change_type === 'database') {
        signals.push('Database-destructive pattern in change');
    }
    else if (change_type === 'architecture') {
        signals.push('Architecture / public surface changed');
    }
    else if (change_type === 'api') {
        signals.push('API surface changed');
    }
    else if (change_type === 'test') {
        signals.push('Test code change');
    }
    else if (change_type === 'config') {
        signals.push('Configuration change');
    }
    else if (change_type === 'logic' && probe.trim()) {
        signals.push('Business logic change detected');
    }
    else if (!probe.trim()) {
        signals.push('No diff — static file check only');
    }
    return {
        change_type,
        severity: severityForType(change_type, lines_added, lines_removed),
        lines_added,
        lines_removed,
        mixed,
        type_hints: uniqueHints.length ? uniqueHints : [change_type],
        signals,
    };
}
