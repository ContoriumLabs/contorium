"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSymbols = validateSymbols;
exports.validateCalls = validateCalls;
exports.refineExtraction = refineExtraction;
const NOISE_NAMES = new Set([
    'constructor', 'toString', 'valueOf', 'then', 'catch', 'finally', 'map', 'filter', 'reduce',
    'forEach', 'push', 'pop', 'slice', 'join', 'length', 'log', 'error', 'warn',
]);
const TS_TYPE_LIKE = /^[A-Z][A-Z0-9_]*$/;
/**
 * Hybrid precision layer (V3.1) — post-filters regex noise.
 * Tree-sitter can replace/enhance this module later without changing the pipeline.
 */
function validateSymbols(symbols) {
    const seen = new Set();
    const out = [];
    for (const sym of symbols) {
        if (sym.kind === 'import') {
            if (sym.name.startsWith('.') || sym.name.includes('/')) {
                out.push(sym);
            }
            continue;
        }
        if (sym.name.length < 2 || NOISE_NAMES.has(sym.name)) {
            continue;
        }
        if (sym.kind === 'function' && TS_TYPE_LIKE.test(sym.name) && sym.name.length <= 3) {
            continue;
        }
        const key = `${sym.kind}::${sym.name}::${sym.line}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(sym);
    }
    return out;
}
function validateCalls(calls, symbols) {
    const fnNames = new Set(symbols.filter((s) => s.kind === 'function').map((s) => s.name));
    return calls.filter((c) => fnNames.has(c) || (!NOISE_NAMES.has(c) && c.length > 2));
}
function refineExtraction(ext) {
    const symbols = validateSymbols(ext.symbols);
    return {
        file: ext.file,
        symbols,
        calls: validateCalls(ext.calls, symbols),
    };
}
