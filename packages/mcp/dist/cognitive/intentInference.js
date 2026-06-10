const KEYWORD_RULES = [
    { re: /auth|jwt|login|session|oauth|password/i, intent: 'authentication debugging', weight: 0.85, signal: 'auth keywords' },
    { re: /mcp|handoff|context protocol/i, intent: 'MCP integration work', weight: 0.82, signal: 'MCP path/content' },
    { re: /extension|vscode|sidebar|webview/i, intent: 'IDE extension development', weight: 0.8, signal: 'extension UI' },
    { re: /test|spec|jest|vitest|playwright/i, intent: 'testing and verification', weight: 0.78, signal: 'test files' },
    { re: /docker|ci|deploy|github-actions/i, intent: 'DevOps and deployment', weight: 0.75, signal: 'devops paths' },
    { re: /readme|docs?\/|documentation/i, intent: 'documentation update', weight: 0.72, signal: 'docs activity' },
    { re: /refactor|rename|cleanup/i, intent: 'code refactoring', weight: 0.7, signal: 'refactor pattern' },
    { re: /fix|bug|error|debug/i, intent: 'bug fixing and debugging', weight: 0.68, signal: 'debug pattern' },
    { re: /landing|\.html|frontend|css|react|vue/i, intent: 'frontend UI work', weight: 0.65, signal: 'frontend files' },
    { re: /api|route|middleware|server/i, intent: 'backend API development', weight: 0.62, signal: 'backend paths' },
];
function inferActionPattern(ctx) {
    const blob = `${ctx.currentTask} ${ctx.focusHint} ${ctx.keyChangeSymbols.join(' ')}`.toLowerCase();
    if (/fix|bug|debug|error/.test(blob)) {
        return 'debug';
    }
    if (/refactor|rename|cleanup/.test(blob)) {
        return 'refactor';
    }
    if (/explore|spike|research|investigate/.test(blob)) {
        return 'explore';
    }
    if (ctx.changedFiles.length > 0) {
        return 'edit';
    }
    return 'unknown';
}
export function inferIntent(ctx) {
    const blob = [
        ctx.currentTask,
        ctx.focusHint,
        ctx.projectType,
        ...ctx.paths,
        ...ctx.keyChangeSymbols,
    ]
        .join(' ')
        .toLowerCase();
    let best = { intent: 'general development', confidence: 0.45, signal: 'default' };
    for (const rule of KEYWORD_RULES) {
        if (rule.re.test(blob) && rule.weight > best.confidence) {
            best = { intent: rule.intent, confidence: rule.weight, signal: rule.signal };
        }
    }
    const signals = [best.signal];
    if (ctx.projectType !== 'backend') {
        signals.push(`project_type:${ctx.projectType}`);
    }
    if (ctx.changedFiles.length >= 3) {
        signals.push('multi_file_edit');
    }
    return {
        intent: best.intent,
        confidence: Math.min(0.95, best.confidence),
        signals,
        action_pattern: inferActionPattern(ctx),
    };
}
export function generateKeywords(ctx, intent) {
    const tokens = new Set();
    const add = (s) => {
        for (const w of s.toLowerCase().split(/[^a-z0-9+#.-]+/)) {
            if (w.length >= 3) {
                tokens.add(w);
            }
        }
    };
    add(intent.intent);
    add(ctx.currentTask);
    add(ctx.focusHint);
    add(ctx.projectType);
    for (const p of ctx.paths) {
        add(pathBasename(p));
        add(p.replace(/\\/g, '/'));
    }
    const domainBoost = {
        auth: ['auth', 'jwt', 'login', 'security', 'middleware'],
        mcp: ['mcp', 'handoff', 'context', 'stdio'],
        'ide-extension': ['extension', 'vscode', 'cursor'],
        frontend: ['html', 'css', 'landing', 'ui'],
        testing: ['test', 'jest', 'spec'],
        devops: ['docker', 'ci', 'deploy'],
    };
    for (const kw of domainBoost[ctx.projectType] ?? []) {
        tokens.add(kw);
    }
    return [...tokens].slice(0, 16);
}
function pathBasename(p) {
    const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] ?? p;
}
