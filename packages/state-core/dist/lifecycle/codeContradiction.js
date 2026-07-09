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
exports.detectCodeDecisionTensions = detectCodeDecisionTensions;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const policy_js_1 = require("./policy.js");
/** Heuristic pairs — decision vocabulary vs implementation signals in paths/events. */
const TENSION_PAIRS = [
    { decision: /\bjwt\b/i, code: /\boauth2?\b/i, label: 'JWT vs OAuth2' },
    { decision: /\boauth2?\b/i, code: /\bjwt\b/i, label: 'OAuth2 vs JWT' },
    { decision: /\bredis\b/i, code: /\b(valkey|dragonfly|memcached)\b/i, label: 'Redis vs alternate store' },
    { decision: /\bmcp\b/i, code: /\b(rest|graphql)\b/i, label: 'MCP vs REST/GraphQL' },
    { decision: /\bmonolith\b/i, code: /\bmicroservice/i, label: 'Monolith vs microservices' },
    { decision: /\bsqlite\b/i, code: /\b(postgres|mysql|mongodb)\b/i, label: 'SQLite vs server DB' },
];
const TEXT_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.json',
    '.md',
    '.yml',
    '.yaml',
    '.toml',
    '.env',
    '.txt',
]);
const STOP_WORDS = new Set([
    'that',
    'this',
    'with',
    'from',
    'have',
    'will',
    'been',
    'were',
    'they',
    'their',
    'about',
    'which',
    'would',
    'should',
    'could',
    'using',
    'because',
    'decision',
    'project',
    'approach',
    'instead',
    'rather',
]);
/** Decision vocabulary → alternate implementation signals in code bodies. */
const KEYWORD_OPPOSING = {
    jwt: [
        { pattern: /\boauth2?\b/i, label: 'OAuth2' },
        { pattern: /\bsession[\s_-]?cookie/i, label: 'session cookies' },
    ],
    oauth: [{ pattern: /\bjwt\b/i, label: 'JWT tokens' }],
    redis: [
        { pattern: /\b(valkey|dragonfly|memcached)\b/i, label: 'alternate cache store' },
    ],
    sqlite: [{ pattern: /\b(postgres|postgresql|mysql|mongodb)\b/i, label: 'server database' }],
    monolith: [{ pattern: /\bmicroservice/i, label: 'microservices' }],
    microservice: [{ pattern: /\bmonolith/i, label: 'monolith' }],
    mcp: [{ pattern: /\b(rest|graphql)\b/i, label: 'REST/GraphQL API' }],
    graphql: [{ pattern: /\brest\b/i, label: 'REST API' }],
    rest: [{ pattern: /\bgraphql\b/i, label: 'GraphQL' }],
};
function extractDecisionKeywords(adrText) {
    const tokens = new Set();
    for (const ac of adrText.match(/\b[A-Z]{2,8}\b/g) ?? []) {
        tokens.add(ac.toLowerCase());
    }
    for (const w of adrText.toLowerCase().match(/\b[a-z][a-z0-9_-]{3,}\b/g) ?? []) {
        if (!STOP_WORDS.has(w)) {
            tokens.add(w);
        }
    }
    return [...tokens].slice(0, 16);
}
function pushTension(out, seen, adr, hit, detail, decisionTerm, codeTerm, confidence) {
    const key = `${adr.id}|${decisionTerm}|${codeTerm}|${hit.path}`;
    if (seen.has(key)) {
        return;
    }
    seen.add(key);
    out.push({
        decision_id: adr.id,
        decision_title: adr.title,
        decision_term: decisionTerm,
        code_signal: hit.path || 'recent changes',
        detail,
        confidence,
        evidence_path: hit.path,
        matched_decision_term: decisionTerm,
        matched_code_term: codeTerm,
    });
}
function normalizedRelPath(workspaceRoot, candidate) {
    const clean = candidate.trim();
    if (!clean || clean.includes('\0')) {
        return undefined;
    }
    const resolved = path.resolve(workspaceRoot, clean);
    const root = path.resolve(workspaceRoot);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        return undefined;
    }
    return resolved;
}
async function readBoundedText(workspaceRoot, relPath) {
    const full = normalizedRelPath(workspaceRoot, relPath);
    if (!full) {
        return undefined;
    }
    const ext = path.extname(full).toLowerCase();
    if (ext && !TEXT_EXTENSIONS.has(ext)) {
        return undefined;
    }
    try {
        const st = await fs.stat(full);
        if (!st.isFile() || st.size > policy_js_1.LIFECYCLE_POLICY.codeScanMaxBytesPerFile) {
            return undefined;
        }
        return await fs.readFile(full, 'utf8');
    }
    catch {
        return undefined;
    }
}
async function buildCodeSignalText(recentPaths, workspaceRoot) {
    const unique = [...new Set(recentPaths.filter(Boolean))].slice(0, policy_js_1.LIFECYCLE_POLICY.codeScanMaxFiles);
    const entries = unique.map((p) => ({ path: p, text: p }));
    if (!workspaceRoot) {
        return entries;
    }
    for (const entry of entries) {
        const text = await readBoundedText(workspaceRoot, entry.path);
        if (text) {
            entry.text = `${entry.path}\n${text}`;
        }
    }
    return entries;
}
/** Scan recent file paths for signals that tension with accepted ADR decisions. */
async function detectCodeDecisionTensions(adrs, recentPaths, workspaceRoot) {
    const active = adrs.filter((a) => a.status === 'accepted' || a.status === 'implemented' || a.status === 'proposed');
    const entries = await buildCodeSignalText(recentPaths, workspaceRoot);
    if (!entries.some((e) => e.text.trim())) {
        return [];
    }
    const out = [];
    const seen = new Set();
    for (const adr of active) {
        const adrText = `${adr.title} ${adr.reason}`.toLowerCase();
        const keywords = extractDecisionKeywords(`${adr.title} ${adr.reason}`);
        for (const pair of TENSION_PAIRS) {
            if (!pair.decision.test(adrText)) {
                continue;
            }
            const hit = entries.find((entry) => pair.code.test(entry.text.toLowerCase()));
            if (!hit) {
                continue;
            }
            const [decisionTerm, codeTerm] = pair.label.split(' vs ');
            pushTension(out, seen, adr, hit, `Decision mentions ${decisionTerm ?? adr.title}; codebase shows ${codeTerm ?? 'alternate approach'} (${hit.path})`, decisionTerm ?? adr.title, codeTerm ?? 'alternate approach', workspaceRoot ? 0.82 : 0.72);
        }
        for (const keyword of keywords) {
            const opposites = KEYWORD_OPPOSING[keyword];
            if (!opposites?.length) {
                continue;
            }
            if (!adrText.includes(keyword)) {
                continue;
            }
            for (const opp of opposites) {
                const hit = entries.find((entry) => opp.pattern.test(entry.text));
                if (!hit) {
                    continue;
                }
                pushTension(out, seen, adr, hit, `ADR emphasizes "${keyword}" but code references ${opp.label} (${hit.path})`, keyword, opp.label, workspaceRoot ? 0.78 : 0.68);
            }
        }
        for (const hit of entries) {
            if (!hit.text.includes('\n')) {
                continue;
            }
            const body = hit.text.slice(hit.path.length).toLowerCase();
            const strongKeywords = keywords.filter((k) => k.length >= 5 && adrText.includes(k));
            const missingInCode = strongKeywords.filter((k) => !body.includes(k));
            if (strongKeywords.length >= 2 && missingInCode.length === strongKeywords.length) {
                pushTension(out, seen, adr, hit, `Decision terms (${strongKeywords.slice(0, 3).join(', ')}) absent from ${hit.path} while alternate stack signals present`, strongKeywords[0] ?? adr.title, 'implementation drift', workspaceRoot ? 0.65 : 0.55);
            }
        }
    }
    return out.slice(0, 16);
}
