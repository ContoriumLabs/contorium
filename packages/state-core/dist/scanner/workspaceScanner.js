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
exports.scanWorkspace = scanWorkspace;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const gitScan_js_1 = require("./gitScan.js");
const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    '.contora',
    '.context-recall',
    'dist',
    'out',
    '.vscode',
    'coverage',
]);
const SKIP_EXT = /\.(png|jpg|jpeg|gif|ico|woff2?|ttf|eot|zip|vsix|map)$/i;
async function readReadmeHint(root) {
    for (const name of ['README.md', 'readme.md', 'Readme.md']) {
        try {
            const text = await fs.readFile(path.join(root, name), 'utf8');
            for (const line of text.split('\n')) {
                const t = line.replace(/^#+\s*/, '').trim();
                if (t.length >= 12 && !/^contorium|table of contents/i.test(t)) {
                    return t.length > 160 ? t.slice(0, 157) + '…' : t;
                }
            }
        }
        catch {
            /* try next */
        }
    }
    return undefined;
}
async function listTopLevelModules(root) {
    const out = [];
    try {
        const entries = await fs.readdir(root, { withFileTypes: true });
        for (const e of entries) {
            if (!e.isDirectory() || e.name.startsWith('.') || SKIP_DIRS.has(e.name)) {
                continue;
            }
            out.push(e.name);
        }
    }
    catch {
        return out;
    }
    return out.slice(0, 12);
}
async function collectRecentFiles(root, maxFiles, maxDepth) {
    const scored = [];
    async function walk(dir, depth) {
        if (depth > maxDepth || scored.length >= maxFiles * 3) {
            return;
        }
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const e of entries) {
            const name = e.name;
            if (name.startsWith('.') && name !== '.env') {
                if (SKIP_DIRS.has(name)) {
                    continue;
                }
            }
            const full = path.join(dir, name);
            const rel = path.relative(root, full).replace(/\\/g, '/');
            if (e.isDirectory()) {
                if (!SKIP_DIRS.has(name)) {
                    await walk(full, depth + 1);
                }
                continue;
            }
            if (SKIP_EXT.test(name)) {
                continue;
            }
            try {
                const st = await fs.stat(full);
                scored.push({ rel, mtime: st.mtimeMs });
            }
            catch {
                /* skip */
            }
        }
    }
    await walk(root, 0);
    scored.sort((a, b) => b.mtime - a.mtime);
    return scored.slice(0, maxFiles).map((s) => s.rel);
}
/** Mode B — workspace filesystem scan (no IDE required). */
async function scanWorkspace(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const now = Date.now();
    const [git, topLevelModules, recentFiles, readmeHint] = await Promise.all([
        (0, gitScan_js_1.scanGitPorcelain)(root),
        listTopLevelModules(root),
        collectRecentFiles(root, 24, 5),
        readReadmeHint(root),
    ]);
    return {
        workspaceRoot: root,
        scannedAt: now,
        topLevelModules,
        recentFiles,
        gitStaged: git.staged,
        gitWorking: git.working,
        readmeHint,
        isGitRepo: git.isRepo,
    };
}
