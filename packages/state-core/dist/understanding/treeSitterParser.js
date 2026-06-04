"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalParseCache = void 0;
exports.parseFileWithAdapter = parseFileWithAdapter;
const extractor_js_1 = require("./extractor.js");
const symbolValidator_js_1 = require("./symbolValidator.js");
/**
 * Hybrid parser adapter (V3.1).
 * Default: regex fast path. Tree-sitter activates when `web-tree-sitter` is installed.
 */
async function parseFileWithAdapter(workspaceRoot, relFile, options = {}) {
    const normalized = relFile.replace(/\\/g, '/');
    if (!(0, extractor_js_1.isCodeFile)(normalized)) {
        return undefined;
    }
    const ts = await tryTreeSitterParse(normalized, options.content, workspaceRoot);
    if (ts) {
        return { extraction: (0, symbolValidator_js_1.refineExtraction)(ts), backend: 'tree-sitter' };
    }
    let raw;
    if (options.content !== undefined) {
        raw = (0, extractor_js_1.extractFromSource)(normalized, options.content);
    }
    else {
        raw = await (0, extractor_js_1.extractFile)(workspaceRoot, normalized);
    }
    if (!raw) {
        return undefined;
    }
    return { extraction: (0, symbolValidator_js_1.refineExtraction)(raw), backend: 'regex' };
}
async function tryTreeSitterParse(relFile, content, workspaceRoot) {
    // V3.2: wire web-tree-sitter + language grammars here (optional peer dependency).
    // Until then, incremental live edits use regex extractFromSource via parseFileWithAdapter.
    void relFile;
    void content;
    void workspaceRoot;
    return undefined;
}
/** In-memory incremental parse cache for IDE live edits. */
class IncrementalParseCache {
    byFile = new Map();
    get(file) {
        return this.byFile.get(file.replace(/\\/g, '/'));
    }
    set(file, extraction) {
        this.byFile.set(file.replace(/\\/g, '/'), extraction);
    }
    invalidate(file) {
        this.byFile.delete(file.replace(/\\/g, '/'));
    }
    clear() {
        this.byFile.clear();
    }
}
exports.IncrementalParseCache = IncrementalParseCache;
