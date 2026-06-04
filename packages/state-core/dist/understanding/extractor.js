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
exports.isCodeFile = isCodeFile;
exports.nodeId = nodeId;
exports.extractFile = extractFile;
exports.extractFromSource = extractFromSource;
exports.resolveRelativeImport = resolveRelativeImport;
exports.symbolNamesByKind = symbolNamesByKind;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']);
const CALL_KEYWORDS = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'typeof', 'instanceof', 'function',
    'class', 'import', 'export', 'await', 'async', 'throw', 'delete', 'void', 'super', 'this',
]);
function norm(rel) {
    return rel.replace(/\\/g, '/');
}
function isCodeFile(rel) {
    const ext = path.extname(rel).toLowerCase();
    return CODE_EXT.has(ext);
}
function nodeId(file, kind, name) {
    return `${norm(file)}::${kind}::${name}`;
}
function extractTsJs(lines) {
    const symbols = [];
    const calls = new Set();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const ln = i + 1;
        const fnMatch = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/) ??
            line.match(/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/) ??
            line.match(/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/);
        if (fnMatch?.[1]) {
            symbols.push({ kind: 'function', name: fnMatch[1], line: ln });
        }
        const classMatch = line.match(/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/);
        if (classMatch?.[1]) {
            symbols.push({ kind: 'class', name: classMatch[1], line: ln });
        }
        const importFrom = line.match(/^\s*import\s+(?:[\w*{}\s,]+?\s+from\s+)?['"]([^'"]+)['"]/);
        if (importFrom?.[1]) {
            symbols.push({ kind: 'import', name: importFrom[1], line: ln, importTarget: importFrom[1] });
        }
        const importSide = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
        if (importSide?.[1] && !importFrom) {
            symbols.push({ kind: 'import', name: importSide[1], line: ln, importTarget: importSide[1] });
        }
        for (const m of line.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
            const name = m[1];
            if (!CALL_KEYWORDS.has(name)) {
                calls.add(name);
            }
        }
    }
    return { symbols, calls: [...calls] };
}
function extractPython(lines) {
    const symbols = [];
    const calls = new Set();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const ln = i + 1;
        const defMatch = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/);
        if (defMatch?.[1]) {
            symbols.push({ kind: 'function', name: defMatch[1], line: ln });
        }
        const classMatch = line.match(/^\s*class\s+([A-Za-z_][\w]*)\s*[(:]/);
        if (classMatch?.[1]) {
            symbols.push({ kind: 'class', name: classMatch[1], line: ln });
        }
        const importMatch = line.match(/^\s*(?:from\s+(\S+)\s+import|import\s+(\S+))/);
        if (importMatch) {
            const target = (importMatch[1] ?? importMatch[2] ?? '').split(',')[0].trim();
            if (target) {
                symbols.push({ kind: 'import', name: target, line: ln, importTarget: target });
            }
        }
        for (const m of line.matchAll(/\b([A-Za-z_][\w]*)\s*\(/g)) {
            const name = m[1];
            if (!CALL_KEYWORDS.has(name) && name !== 'def' && name !== 'class') {
                calls.add(name);
            }
        }
    }
    return { symbols, calls: [...calls] };
}
async function extractFile(workspaceRoot, relFile) {
    const normalized = norm(relFile);
    if (!isCodeFile(normalized)) {
        return undefined;
    }
    const abs = path.join(workspaceRoot, normalized);
    let text;
    try {
        text = await fs.readFile(abs, 'utf8');
    }
    catch {
        return undefined;
    }
    if (text.length > 512_000) {
        return undefined;
    }
    const lines = text.split('\n');
    const ext = path.extname(normalized).toLowerCase();
    const parsed = ext === '.py' ? extractPython(lines) : extractTsJs(lines);
    return { file: normalized, symbols: parsed.symbols, calls: parsed.calls };
}
/** Parse in-memory source (IDE live edit / incremental path). */
function extractFromSource(relFile, text) {
    const normalized = norm(relFile);
    if (!isCodeFile(normalized) || text.length > 512_000) {
        return undefined;
    }
    const lines = text.split('\n');
    const ext = path.extname(normalized).toLowerCase();
    const parsed = ext === '.py' ? extractPython(lines) : extractTsJs(lines);
    return { file: normalized, symbols: parsed.symbols, calls: parsed.calls };
}
function resolveRelativeImport(fromFile, importTarget) {
    if (!importTarget.startsWith('.')) {
        return undefined;
    }
    const base = path.dirname(fromFile);
    const joined = norm(path.join(base, importTarget));
    const candidates = [
        joined,
        `${joined}.ts`,
        `${joined}.tsx`,
        `${joined}.js`,
        `${joined}.jsx`,
        `${joined}/index.ts`,
        `${joined}/index.js`,
    ];
    return candidates[0];
}
function symbolNamesByKind(extraction, kind) {
    return extraction.symbols.filter((s) => s.kind === kind).map((s) => s.name);
}
